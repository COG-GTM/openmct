/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

/**
 * Self-contained Keplerian orbit propagator with J2 secular perturbations.
 *
 * This is a deliberately compact, dependency-free implementation intended for
 * demonstration and screening purposes. It parses a standard two-line element
 * set (TLE), recovers the classical orbital elements, applies the dominant
 * (J2) secular drift to the right ascension of the ascending node (RAAN),
 * argument of perigee, and mean anomaly, and then solves Kepler's equation to
 * produce an Earth-centered inertial (ECI) position at an arbitrary epoch.
 *
 * It is NOT an SGP4 implementation. SGP4 additionally models atmospheric drag,
 * short/long period periodic terms, and resonance effects, and should be used
 * for anything operational. For a screening demo over a ~24h window the J2
 * secular model captures the first-order geometry well enough to illustrate
 * conjunction detection.
 */

const MU = 398600.4418; // Earth gravitational parameter, km^3/s^2
const J2 = 1.08262668e-3; // Earth second zonal harmonic
const RE = 6378.137; // Earth equatorial radius, km (WGS84)
const WGS84_F = 1 / 298.257223563; // WGS84 flattening
const WGS84_E2 = WGS84_F * (2 - WGS84_F); // first eccentricity squared
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;

/**
 * Normalize an angle (radians) to the range [0, 2π).
 * @param {number} angle
 * @returns {number}
 */
function normalizeAngle(angle) {
  let result = angle % TWO_PI;
  if (result < 0) {
    result += TWO_PI;
  }

  return result;
}

export default class OrbitPropagator {
  /**
   * @param {{line1: string, line2: string}} tle two-line element set
   * @param {string} [name] optional object name, used only for diagnostics
   */
  constructor(tle, name) {
    this.name = name;
    this.elements = OrbitPropagator.parseTLE(tle);
    this.#computeSecularRates();
  }

  /**
   * Parse a TLE into classical orbital elements using the standard column
   * layout defined by NORAD.
   *
   * @param {{line1: string, line2: string}} tle
   * @returns {Object} parsed elements (angles in radians, a in km)
   */
  static parseTLE(tle) {
    const line1 = tle.line1;
    const line2 = tle.line2;

    // Epoch: 2-digit year + fractional day-of-year (line 1, cols 19-32).
    const epochYearTwoDigit = parseInt(line1.substring(18, 20), 10);
    const epochYear = epochYearTwoDigit < 57 ? 2000 + epochYearTwoDigit : 1900 + epochYearTwoDigit;
    const epochDay = parseFloat(line1.substring(20, 32));
    const epochMs = OrbitPropagator.#epochToMs(epochYear, epochDay);

    // Line 2 classical elements.
    const inclination = parseFloat(line2.substring(8, 16)) * DEG2RAD;
    const raan = parseFloat(line2.substring(17, 25)) * DEG2RAD;
    // Eccentricity is stored with an assumed leading decimal point.
    const eccentricity = parseFloat(`0.${line2.substring(26, 33).trim()}`);
    const argOfPerigee = parseFloat(line2.substring(34, 42)) * DEG2RAD;
    const meanAnomaly = parseFloat(line2.substring(43, 51)) * DEG2RAD;
    const meanMotionRevPerDay = parseFloat(line2.substring(52, 63));

    // Mean motion (rev/day) -> rad/s, then semi-major axis via Kepler's third law.
    const meanMotion = (meanMotionRevPerDay * TWO_PI) / 86400;
    const semiMajorAxis = Math.cbrt(MU / (meanMotion * meanMotion));

    return {
      epochMs,
      inclination,
      raan,
      eccentricity,
      argOfPerigee,
      meanAnomaly,
      meanMotion,
      semiMajorAxis
    };
  }

  /**
   * Convert a TLE epoch (year + fractional day-of-year, 1-based) to a Unix
   * timestamp in milliseconds (UTC).
   * @param {number} year
   * @param {number} dayOfYear
   * @returns {number}
   */
  static #epochToMs(year, dayOfYear) {
    const startOfYear = Date.UTC(year, 0, 1);

    return startOfYear + (dayOfYear - 1) * 86400000;
  }

  /**
   * Precompute the J2 secular rates of change for RAAN, argument of perigee,
   * and mean anomaly. All rates are in rad/s.
   */
  #computeSecularRates() {
    const { semiMajorAxis: a, eccentricity: e, inclination: i, meanMotion: n } = this.elements;
    const p = a * (1 - e * e); // semi-latus rectum
    const cosI = Math.cos(i);
    const sinI2 = Math.sin(i) * Math.sin(i);
    const factor = 1.5 * J2 * Math.pow(RE / p, 2) * n;

    this.raanDot = -factor * cosI;
    this.argOfPerigeeDot = factor * (2 - 2.5 * sinI2);
    this.meanAnomalyDot = n + factor * Math.sqrt(1 - e * e) * (1 - 1.5 * sinI2);
  }

  /**
   * Solve Kepler's equation M = E - e*sin(E) for the eccentric anomaly E using
   * Newton-Raphson iteration.
   * @param {number} meanAnomaly radians
   * @param {number} eccentricity
   * @returns {number} eccentric anomaly, radians
   */
  #solveKepler(meanAnomaly, eccentricity) {
    let E = eccentricity < 0.8 ? meanAnomaly : Math.PI;
    for (let iteration = 0; iteration < 50; iteration++) {
      const delta =
        (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-10) {
        break;
      }
    }

    return E;
  }

  /**
   * Compute the ECI position of the object at the given epoch.
   * @param {number} timestampMs Unix time in milliseconds
   * @returns {{x: number, y: number, z: number}} ECI position in km
   */
  getECI(timestampMs) {
    const { semiMajorAxis: a, eccentricity: e, inclination: i } = this.elements;
    const dtSeconds = (timestampMs - this.elements.epochMs) / 1000;

    // Apply secular drift to the time-varying angles.
    const raan = normalizeAngle(this.elements.raan + this.raanDot * dtSeconds);
    const argOfPerigee = normalizeAngle(
      this.elements.argOfPerigee + this.argOfPerigeeDot * dtSeconds
    );
    const meanAnomaly = normalizeAngle(this.elements.meanAnomaly + this.meanAnomalyDot * dtSeconds);

    const E = this.#solveKepler(meanAnomaly, e);

    // True anomaly and radius.
    const trueAnomaly = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
    const r = a * (1 - e * Math.cos(E));

    // Perifocal (orbital plane) coordinates.
    const xPerifocal = r * Math.cos(trueAnomaly);
    const yPerifocal = r * Math.sin(trueAnomaly);

    // Rotate perifocal -> ECI via the 3-1-3 (RAAN, inclination, argp) sequence.
    const cosO = Math.cos(raan);
    const sinO = Math.sin(raan);
    const cosW = Math.cos(argOfPerigee);
    const sinW = Math.sin(argOfPerigee);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);

    const x =
      (cosO * cosW - sinO * sinW * cosI) * xPerifocal +
      (-cosO * sinW - sinO * cosW * cosI) * yPerifocal;
    const y =
      (sinO * cosW + cosO * sinW * cosI) * xPerifocal +
      (-sinO * sinW + cosO * cosW * cosI) * yPerifocal;
    const z = sinW * sinI * xPerifocal + cosW * sinI * yPerifocal;

    return { x, y, z };
  }

  /**
   * Greenwich Mean Sidereal Time for the given epoch, in radians.
   * @param {number} timestampMs
   * @returns {number}
   */
  static #gmst(timestampMs) {
    const jd = timestampMs / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525;
    // GMST in seconds of time (IAU 1982 model).
    let gmstSeconds =
      67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
    // 240 seconds of time per degree -> degrees, wrapped to [0, 360).
    let gmstDeg = (gmstSeconds / 240) % 360;
    if (gmstDeg < 0) {
      gmstDeg += 360;
    }

    return gmstDeg * DEG2RAD;
  }

  /**
   * Compute geodetic latitude, longitude and altitude of the object.
   *
   * The ECI position is rotated into an Earth-fixed (ECEF) frame using GMST to
   * account for Earth's rotation, then converted to WGS84 geodetic coordinates.
   *
   * @param {number} timestampMs Unix time in milliseconds
   * @returns {{lat: number, lon: number, alt: number}} degrees, degrees, km
   */
  getGeodetic(timestampMs) {
    const eci = this.getECI(timestampMs);
    const theta = OrbitPropagator.#gmst(timestampMs);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    // Rotate ECI -> ECEF about the z-axis by GMST.
    const xEcef = cosTheta * eci.x + sinTheta * eci.y;
    const yEcef = -sinTheta * eci.x + cosTheta * eci.y;
    const zEcef = eci.z;

    const lon = Math.atan2(yEcef, xEcef);
    const p = Math.sqrt(xEcef * xEcef + yEcef * yEcef);

    // Iterative solution for geodetic latitude / altitude (WGS84 ellipsoid).
    let lat = Math.atan2(zEcef, p * (1 - WGS84_E2));
    let alt = 0;
    for (let iteration = 0; iteration < 10; iteration++) {
      const sinLat = Math.sin(lat);
      const cosLat = Math.cos(lat);
      const N = RE / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
      // Near the poles p (and cos(lat)) approach zero; use the polar-safe form
      // (project onto the z-axis) to avoid a 0/0 -> NaN altitude.
      alt = Math.abs(cosLat) > 1e-6 ? p / cosLat - N : Math.abs(zEcef) - N * (1 - WGS84_E2);
      const newLat = Math.atan2(zEcef, p * (1 - (WGS84_E2 * N) / (N + alt)));
      if (Math.abs(newLat - lat) < 1e-11) {
        lat = newLat;
        break;
      }
      lat = newLat;
    }

    return {
      lat: lat * RAD2DEG,
      lon: lon * RAD2DEG,
      alt
    };
  }
}

export { J2, MU, RE };
