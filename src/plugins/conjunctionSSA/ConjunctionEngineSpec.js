import { ConjunctionEngine, pairKey } from './ConjunctionEngine.js';
import { SEED_TLES } from './tles.js';

const ISS_SEED = SEED_TLES.find((tle) => tle.id === '25544');
const CHASER_SEED = SEED_TLES.find((tle) => tle.id === '99999');
const HST_SEED = SEED_TLES.find((tle) => tle.id === '20580');

function makeEngineAt(nowMs, seeds) {
  return new ConjunctionEngine({
    seeds,
    now: () => nowMs,
    tickIntervalMs: 60_000,
    lookAheadSeconds: 30 * 60,
    coarseStepSeconds: 30
  });
}

describe('ConjunctionEngine', () => {
  it('registers a history buffer for each tracked object and pair', () => {
    const engine = makeEngineAt(ISS_SEED.tle1 ? Date.UTC(2024, 0, 1, 12) : 0, [ISS_SEED, HST_SEED]);
    expect(engine.trackedIds).toEqual(['25544', '20580']);
    expect(engine.listPairs()).toEqual([
      { primaryId: '25544', secondaryId: '20580', key: pairKey('25544', '20580') }
    ]);
    expect(engine.getHistory(`tracked:25544`, -Infinity, Infinity)).toEqual([]);
  });

  it('produces a tracked telemetry datum on tick', () => {
    const nowMs = Date.UTC(2024, 0, 1, 12);
    const engine = makeEngineAt(nowMs, [ISS_SEED]);
    engine.tick();
    const history = engine.getHistory('tracked:25544', -Infinity, Infinity);
    expect(history.length).toBe(1);
    expect(history[0].utc).toBe(nowMs);
    expect(Number.isFinite(history[0].lat)).toBeTrue();
    expect(Number.isFinite(history[0].lon)).toBeTrue();
    expect(history[0].alt).toBeGreaterThan(300);
  });

  it('screens the ISS vs synthetic chaser pair and finds a close approach', () => {
    const nowMs = Date.UTC(2024, 0, 1, 12);
    const engine = makeEngineAt(nowMs, [ISS_SEED, CHASER_SEED]);
    engine.tick();
    const pairHistoryKey = `pair:${pairKey('25544', '99999')}`;
    const [datum] = engine.getHistory(pairHistoryKey, -Infinity, Infinity);
    expect(datum).toBeDefined();
    expect(datum.missKm).toBeLessThan(200);
    expect(datum.pc).toBeGreaterThanOrEqual(0);
    expect(datum.tcaOffsetS).toBeGreaterThanOrEqual(0);
  });

  it('emits a worst-case summary datum with the smallest pair miss distance', () => {
    const nowMs = Date.UTC(2024, 0, 1, 12);
    const engine = makeEngineAt(nowMs, [ISS_SEED, CHASER_SEED, HST_SEED]);
    engine.tick();
    const [summary] = engine.getHistory('pair:summary', -Infinity, Infinity);
    const pairs = engine
      .listPairs()
      .map((p) => {
        const [entry] = engine.getHistory(`pair:${p.key}`, -Infinity, Infinity);
        return entry.missKm;
      })
      .filter((missKm) => !Number.isNaN(missKm));
    const smallestMiss = Math.min(...pairs);
    expect(summary.missKm).toBeCloseTo(smallestMiss, 6);
  });

  it('reports NaN miss distance for pairs with no close approach in the window', () => {
    const nowMs = Date.UTC(2024, 0, 1, 12);
    const engine = makeEngineAt(nowMs, [ISS_SEED, HST_SEED]);
    engine.tick();
    const [datum] = engine.getHistory(`pair:${pairKey('25544', '20580')}`, -Infinity, Infinity);
    expect(Number.isNaN(datum.missKm)).toBeTrue();
    expect(Number.isNaN(datum.tcaOffsetS)).toBeTrue();
    expect(datum.pc).toBe(0);
  });

  it('excludes non-converging pairs from the worst-case summary', () => {
    const nowMs = Date.UTC(2024, 0, 1, 12);
    const engine = makeEngineAt(nowMs, [ISS_SEED, CHASER_SEED, HST_SEED]);
    engine.tick();
    const [summary] = engine.getHistory('pair:summary', -Infinity, Infinity);
    expect(Number.isFinite(summary.missKm)).toBeTrue();
    expect(summary.pairKey).not.toContain('20580');
  });

  it('fires subscriber callbacks on tick', () => {
    const engine = makeEngineAt(Date.UTC(2024, 0, 1, 12), [ISS_SEED, HST_SEED]);
    const callback = jasmine.createSpy('subscriber');
    const unsubscribe = engine.subscribe('tracked:25544', callback);
    engine.tick();
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    engine.tick();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('caps history buffers at 500 entries', () => {
    const engine = makeEngineAt(0, [ISS_SEED]);
    for (let i = 0; i < 600; i += 1) {
      engine.now = () => i * 1000;
      engine.tick();
    }
    expect(engine.getHistory('tracked:25544', -Infinity, Infinity).length).toBe(500);
  });
});
