const MU_EARTH_KM3_S2 = 398600.4418;
const R_EARTH_KM = 6378.137;
const J2 = 1.08262668e-3;
const OMEGA_EARTH_RAD_S = 7.2921159e-5;
const TWO_PI = Math.PI * 2;
const KEPLER_TOLERANCE = 1e-10;
const KEPLER_MAX_ITER = 25;
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

function solveKepler(meanAnomaly, eccentricity) {
  let m = meanAnomaly % TWO_PI;
  if (m < 0) {
    m += TWO_PI;
  }
  let eccentricAnomaly = eccentricity < 0.8 ? m : Math.PI;
  for (let i = 0; i < KEPLER_MAX_ITER; i += 1) {
    const delta =
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - m) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < KEPLER_TOLERANCE) {
      break;
    }
  }
  return eccentricAnomaly;
}

function j2Rates(elements) {
  const {
    semiMajorAxisKm: a,
    eccentricity: e,
    inclinationRad: i,
    meanMotionRadPerSec: n0
  } = elements;
  const p = a * (1 - e * e);
  const factor = 1.5 * n0 * J2 * (R_EARTH_KM / p) ** 2;
  const cosI = Math.cos(i);
  const raanDot = -factor * cosI;
  const argPerigeeDot = 0.5 * factor * (5 * cosI * cosI - 1);
  const meanAnomalyDot = n0 + 0.5 * factor * Math.sqrt(1 - e * e) * (3 * cosI * cosI - 1);
  return { raanDot, argPerigeeDot, meanAnomalyDot };
}

function propagateEci(elements, timestampMs) {
  const dt = (timestampMs - elements.epochMs) / 1000;
  const { raanDot, argPerigeeDot, meanAnomalyDot } = j2Rates(elements);
  const raan = elements.raanRad + raanDot * dt;
  const argPerigee = elements.argPerigeeRad + argPerigeeDot * dt;
  const meanAnomaly = elements.meanAnomalyRad + meanAnomalyDot * dt;
  const e = elements.eccentricity;
  const a = elements.semiMajorAxisKm;

  const eccentricAnomaly = solveKepler(meanAnomaly, e);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const sqrt1MinusE2 = Math.sqrt(1 - e * e);
  const trueAnomaly = Math.atan2(sqrt1MinusE2 * sinE, cosE - e);
  const radius = a * (1 - e * cosE);

  const xPerifocal = radius * Math.cos(trueAnomaly);
  const yPerifocal = radius * Math.sin(trueAnomaly);
  const meanMotion = Math.sqrt(MU_EARTH_KM3_S2 / (a * a * a));
  const vxPerifocal = -(a * meanMotion * sinE) / (1 - e * cosE);
  const vyPerifocal = (a * meanMotion * sqrt1MinusE2 * cosE) / (1 - e * cosE);

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosW = Math.cos(argPerigee);
  const sinW = Math.sin(argPerigee);
  const cosI = Math.cos(elements.inclinationRad);
  const sinI = Math.sin(elements.inclinationRad);

  const r11 = cosO * cosW - sinO * sinW * cosI;
  const r12 = -cosO * sinW - sinO * cosW * cosI;
  const r21 = sinO * cosW + cosO * sinW * cosI;
  const r22 = -sinO * sinW + cosO * cosW * cosI;
  const r31 = sinW * sinI;
  const r32 = cosW * sinI;

  return {
    position: [
      r11 * xPerifocal + r12 * yPerifocal,
      r21 * xPerifocal + r22 * yPerifocal,
      r31 * xPerifocal + r32 * yPerifocal
    ],
    velocity: [
      r11 * vxPerifocal + r12 * vyPerifocal,
      r21 * vxPerifocal + r22 * vyPerifocal,
      r31 * vxPerifocal + r32 * vyPerifocal
    ]
  };
}

function gmstRad(timestampMs) {
  const daysSinceJ2000 = (timestampMs - J2000_EPOCH_MS) / (86400 * 1000);
  const gmstDeg = (280.46061837 + 360.98564736629 * daysSinceJ2000) % 360;
  return ((gmstDeg + 360) % 360) * (Math.PI / 180);
}

function eciToGeodetic(positionKm, timestampMs) {
  const gmst = gmstRad(timestampMs);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const [x, y, z] = positionKm;
  const xEcef = cosG * x + sinG * y;
  const yEcef = -sinG * x + cosG * y;
  const zEcef = z;
  const radius = Math.sqrt(xEcef * xEcef + yEcef * yEcef + zEcef * zEcef);
  const latRad = Math.asin(zEcef / radius);
  const lonRad = Math.atan2(yEcef, xEcef);
  return {
    latDeg: (latRad * 180) / Math.PI,
    lonDeg: (lonRad * 180) / Math.PI,
    altKm: radius - R_EARTH_KM
  };
}

function distanceKm(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function speedKmS(velocity) {
  return Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2);
}

export {
  distanceKm,
  eciToGeodetic,
  gmstRad,
  J2,
  MU_EARTH_KM3_S2,
  OMEGA_EARTH_RAD_S,
  propagateEci,
  R_EARTH_KM,
  solveKepler,
  speedKmS
};
