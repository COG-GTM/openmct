const SEED_TLES = [
  {
    id: '25544',
    name: 'ISS (ZARYA)',
    group: 'crewed',
    tle1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9994',
    tle2: '2 25544  51.6416  85.0000 0002829  30.0000 330.0000 15.50000000    07'
  },
  {
    id: '20580',
    name: 'HST (HUBBLE)',
    group: 'science',
    tle1: '1 20580U 90037B   24001.50000000  .00001234  00000-0  10000-4 0  9990',
    tle2: '2 20580  28.4696 120.0000 0002707 250.0000 110.0000 15.09000000    05'
  },
  {
    id: '25994',
    name: 'TERRA',
    group: 'science',
    tle1: '1 25994U 99068A   24001.50000000  .00000200  00000-0  50000-4 0  9991',
    tle2: '2 25994  98.2100  10.0000 0001500  90.0000 270.0000 14.57100000    03'
  },
  {
    id: '27386',
    name: 'ENVISAT',
    group: 'debris-large',
    tle1: '1 27386U 02009A   24001.50000000  .00000050  00000-0  20000-4 0  9992',
    tle2: '2 27386  98.4000  20.0000 0001200 100.0000 260.0000 14.37800000    01'
  },
  {
    id: '33759',
    name: 'IRIDIUM 33 DEB',
    group: 'debris',
    tle1: '1 33759U 97051X   24001.50000000  .00000100  00000-0  30000-4 0  9993',
    tle2: '2 33759  86.4000  40.0000 0003000 160.0000 200.0000 14.34000000    02'
  },
  {
    id: '34454',
    name: 'COSMOS 2251 DEB',
    group: 'debris',
    tle1: '1 34454U 93036AAB 24001.50000000  .00000150  00000-0  40000-4 0  9995',
    tle2: '2 34454  74.0000  60.0000 0005000 140.0000 220.0000 14.20000000    04'
  },
  {
    id: '44714',
    name: 'STARLINK-1007',
    group: 'starlink',
    tle1: '1 44714U 19074A   24001.50000000  .00003000  00000-0  20000-3 0  9996',
    tle2: '2 44714  53.0500  80.0000 0001500  90.0000 270.0000 15.06000000    06'
  },
  {
    id: '99999',
    name: 'TEST CHASER (synthetic)',
    group: 'synthetic',
    tle1: '1 99999U 24001A   24001.50000000  .00016717  00000-0  10270-3 0  9998',
    tle2: '2 99999  51.6516  85.0500 0002829  30.0000 330.2000 15.50000000    08'
  }
];

const MU_EARTH_KM3_S2 = 398600.4418;
const SECONDS_PER_DAY = 86400;
const TWO_PI = Math.PI * 2;

function parseFloatFixed(str) {
  return Number.parseFloat(str);
}

function parseEpoch(tle1) {
  const yy = Number.parseInt(tle1.substring(18, 20), 10);
  const doy = parseFloatFixed(tle1.substring(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const jan1 = Date.UTC(year, 0, 1);
  return jan1 + (doy - 1) * SECONDS_PER_DAY * 1000;
}

function parseTle(tle1, tle2) {
  if (!tle1 || !tle2 || tle1.length < 63 || tle2.length < 63) {
    throw new Error('Invalid TLE line lengths');
  }

  const epochMs = parseEpoch(tle1);
  const inclinationDeg = parseFloatFixed(tle2.substring(8, 16));
  const raanDeg = parseFloatFixed(tle2.substring(17, 25));
  const eccentricity = parseFloatFixed('0.' + tle2.substring(26, 33).trim());
  const argPerigeeDeg = parseFloatFixed(tle2.substring(34, 42));
  const meanAnomalyDeg = parseFloatFixed(tle2.substring(43, 51));
  const meanMotionRevPerDay = parseFloatFixed(tle2.substring(52, 63));

  const meanMotionRadPerSec = (meanMotionRevPerDay * TWO_PI) / SECONDS_PER_DAY;
  const semiMajorAxisKm = Math.cbrt(MU_EARTH_KM3_S2 / meanMotionRadPerSec ** 2);

  return {
    epochMs,
    inclinationRad: (inclinationDeg * Math.PI) / 180,
    raanRad: (raanDeg * Math.PI) / 180,
    eccentricity,
    argPerigeeRad: (argPerigeeDeg * Math.PI) / 180,
    meanAnomalyRad: (meanAnomalyDeg * Math.PI) / 180,
    meanMotionRadPerSec,
    semiMajorAxisKm
  };
}

export { parseTle, SEED_TLES };
