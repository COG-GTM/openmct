import { distanceKm, eciToGeodetic, propagateEci, R_EARTH_KM, solveKepler } from './propagator.js';
import { parseTle, SEED_TLES } from './tles.js';

describe('propagator', () => {
  const issTle = SEED_TLES.find((tle) => tle.id === '25544');
  const issElements = parseTle(issTle.tle1, issTle.tle2);

  describe('solveKepler', () => {
    it('returns 0 when M is 0', () => {
      expect(solveKepler(0, 0.01)).toBeCloseTo(0, 10);
    });

    it('satisfies Kepler equation to high precision', () => {
      const meanAnomaly = 1.234;
      const eccentricity = 0.05;
      const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);
      const residual = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly;
      expect(Math.abs(residual)).toBeLessThan(1e-9);
    });
  });

  describe('parseTle', () => {
    it('extracts a plausible LEO semi-major axis for the ISS', () => {
      expect(issElements.semiMajorAxisKm).toBeGreaterThan(6700);
      expect(issElements.semiMajorAxisKm).toBeLessThan(6800);
    });

    it('parses inclination near 51.6 degrees for the ISS', () => {
      expect((issElements.inclinationRad * 180) / Math.PI).toBeCloseTo(51.6416, 3);
    });
  });

  describe('propagateEci', () => {
    it('produces a position at roughly the semi-major axis magnitude', () => {
      const state = propagateEci(issElements, issElements.epochMs);
      const radius = Math.sqrt(
        state.position[0] ** 2 + state.position[1] ** 2 + state.position[2] ** 2
      );
      expect(radius).toBeGreaterThan(issElements.semiMajorAxisKm * 0.99);
      expect(radius).toBeLessThan(issElements.semiMajorAxisKm * 1.01);
    });

    it('returns to a nearby position after one full orbital period', () => {
      const periodSeconds = (2 * Math.PI) / issElements.meanMotionRadPerSec;
      const stateA = propagateEci(issElements, issElements.epochMs);
      const stateB = propagateEci(issElements, issElements.epochMs + periodSeconds * 1000);
      expect(distanceKm(stateA.position, stateB.position)).toBeLessThan(50);
    });
  });

  describe('eciToGeodetic', () => {
    it('produces altitude above the Earth surface for a LEO position', () => {
      const state = propagateEci(issElements, issElements.epochMs);
      const geo = eciToGeodetic(state.position, issElements.epochMs);
      expect(geo.altKm).toBeGreaterThan(300);
      expect(geo.altKm).toBeLessThan(500);
      expect(Math.abs(geo.latDeg)).toBeLessThanOrEqual(52);
    });

    it('produces longitudes in [-180, 180]', () => {
      const state = propagateEci(issElements, issElements.epochMs + 3600 * 1000);
      const geo = eciToGeodetic(state.position, issElements.epochMs + 3600 * 1000);
      expect(geo.lonDeg).toBeGreaterThanOrEqual(-180);
      expect(geo.lonDeg).toBeLessThanOrEqual(180);
    });

    it('yields a radius equal to R_EARTH plus altitude', () => {
      const state = propagateEci(issElements, issElements.epochMs);
      const geo = eciToGeodetic(state.position, issElements.epochMs);
      const radius = Math.sqrt(
        state.position[0] ** 2 + state.position[1] ** 2 + state.position[2] ** 2
      );
      expect(radius).toBeCloseTo(R_EARTH_KM + geo.altKm, 6);
    });
  });
});
