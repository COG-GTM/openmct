import { probabilityOfCollision } from './pc.js';

describe('probabilityOfCollision', () => {
  it('is maximized at zero miss distance', () => {
    const pcZero = probabilityOfCollision(0);
    const pcSmall = probabilityOfCollision(0.05);
    expect(pcZero).toBeGreaterThan(pcSmall);
  });

  it('decreases monotonically as miss distance increases', () => {
    let previous = Infinity;
    for (let missKm = 0; missKm <= 5; missKm += 0.5) {
      const value = probabilityOfCollision(missKm);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('scales with the hard-body radius squared', () => {
    const smallHbr = probabilityOfCollision(0, { hardBodyRadiusM: 10 });
    const largeHbr = probabilityOfCollision(0, { hardBodyRadiusM: 20 });
    expect(largeHbr / smallHbr).toBeCloseTo(4, 6);
  });

  it('produces a value greater than 1e-4 for a very close approach', () => {
    const pc = probabilityOfCollision(0.05, { hardBodyRadiusM: 10, positionSigmaM: 50 });
    expect(pc).toBeGreaterThan(1e-4);
  });
});
