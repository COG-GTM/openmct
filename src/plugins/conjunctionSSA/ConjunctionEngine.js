import { probabilityOfCollision } from './pc.js';
import { distanceKm, eciToGeodetic, propagateEci, speedKmS } from './propagator.js';
import { parseTle } from './tles.js';

const DEFAULT_LOOK_AHEAD_SECONDS = 30 * 60;
const DEFAULT_COARSE_STEP_SECONDS = 30;
const DEFAULT_REFINEMENT_TOLERANCE_SECONDS = 1;
const DEFAULT_TICK_INTERVAL_MS = 5000;
const HISTORY_BUFFER_SIZE = 500;
const GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;
const GOLDEN_MAX_ITER = 50;

function pairKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function pushCapped(buffer, datum, cap) {
  buffer.push(datum);
  if (buffer.length > cap) {
    buffer.shift();
  }
}

class ConjunctionEngine {
  constructor(options = {}) {
    this.lookAheadSeconds = options.lookAheadSeconds ?? DEFAULT_LOOK_AHEAD_SECONDS;
    this.coarseStepSeconds = options.coarseStepSeconds ?? DEFAULT_COARSE_STEP_SECONDS;
    this.refinementToleranceSeconds =
      options.refinementToleranceSeconds ?? DEFAULT_REFINEMENT_TOLERANCE_SECONDS;
    this.tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
    this.now = options.now ?? (() => Date.now());
    this.pcOptions = options.pcOptions ?? {};

    this.elementsById = new Map();
    this.trackedIds = [];
    this.history = new Map();
    this.subscribers = new Map();
    this.timerId = null;

    if (options.seeds) {
      options.seeds.forEach((seed) => this.addTracked(seed));
    }
  }

  addTracked(seed) {
    const elements = parseTle(seed.tle1, seed.tle2);
    this.elementsById.set(seed.id, { seed, elements });
    if (!this.trackedIds.includes(seed.id)) {
      this.trackedIds.push(seed.id);
    }
    this.history.set(`tracked:${seed.id}`, []);
    if (!this.history.has('pair:summary')) {
      this.history.set('pair:summary', []);
    }
    this.trackedIds.forEach((otherId) => {
      if (otherId === seed.id) {
        return;
      }
      this.history.set(`pair:${pairKey(seed.id, otherId)}`, []);
    });
  }

  listPairs() {
    const pairs = [];
    for (let i = 0; i < this.trackedIds.length; i += 1) {
      for (let j = i + 1; j < this.trackedIds.length; j += 1) {
        pairs.push({
          primaryId: this.trackedIds[i],
          secondaryId: this.trackedIds[j],
          key: pairKey(this.trackedIds[i], this.trackedIds[j])
        });
      }
    }
    return pairs;
  }

  propagateTracked(id, timestampMs) {
    const entry = this.elementsById.get(id);
    if (!entry) {
      throw new Error(`Unknown tracked object: ${id}`);
    }
    const state = propagateEci(entry.elements, timestampMs);
    const geodetic = eciToGeodetic(state.position, timestampMs);
    return {
      utc: timestampMs,
      lat: geodetic.latDeg,
      lon: geodetic.lonDeg,
      alt: geodetic.altKm,
      speedKmS: speedKmS(state.velocity),
      eci: state.position
    };
  }

  screenPair(primaryId, secondaryId, startMs, endMs) {
    const primaryEntry = this.elementsById.get(primaryId);
    const secondaryEntry = this.elementsById.get(secondaryId);
    if (!primaryEntry || !secondaryEntry) {
      throw new Error('Unknown pair member');
    }

    const stepMs = this.coarseStepSeconds * 1000;
    let previousDistance = Infinity;
    let previousPreviousDistance = Infinity;
    let previousTime = startMs;
    let previousPreviousTime = startMs;
    let bestBracket = null;
    let bestBracketMiss = Infinity;

    for (let t = startMs; t <= endMs; t += stepMs) {
      const primaryState = propagateEci(primaryEntry.elements, t);
      const secondaryState = propagateEci(secondaryEntry.elements, t);
      const d = distanceKm(primaryState.position, secondaryState.position);

      if (
        previousPreviousDistance !== Infinity &&
        previousDistance < previousPreviousDistance &&
        previousDistance < d &&
        previousDistance < bestBracketMiss
      ) {
        bestBracketMiss = previousDistance;
        bestBracket = [previousPreviousTime, t];
      }

      previousPreviousDistance = previousDistance;
      previousPreviousTime = previousTime;
      previousDistance = d;
      previousTime = t;
    }

    if (!bestBracket) {
      return null;
    }

    const refined = this.refineTca(primaryEntry.elements, secondaryEntry.elements, bestBracket);
    return {
      tcaMs: refined.tcaMs,
      missKm: refined.missKm,
      pc: probabilityOfCollision(refined.missKm, this.pcOptions)
    };
  }

  refineTca(primaryElements, secondaryElements, bracket) {
    let [lo, hi] = bracket;
    let iter = 0;
    while (hi - lo > this.refinementToleranceSeconds * 1000 && iter < GOLDEN_MAX_ITER) {
      const c = hi - (hi - lo) * GOLDEN_RATIO;
      const d = lo + (hi - lo) * GOLDEN_RATIO;
      const dc = distanceKm(
        propagateEci(primaryElements, c).position,
        propagateEci(secondaryElements, c).position
      );
      const dd = distanceKm(
        propagateEci(primaryElements, d).position,
        propagateEci(secondaryElements, d).position
      );
      if (dc < dd) {
        hi = d;
      } else {
        lo = c;
      }
      iter += 1;
    }
    const tcaMs = (lo + hi) / 2;
    const missKm = distanceKm(
      propagateEci(primaryElements, tcaMs).position,
      propagateEci(secondaryElements, tcaMs).position
    );
    return { tcaMs, missKm };
  }

  screenAllPairs(nowMs) {
    const endMs = nowMs + this.lookAheadSeconds * 1000;
    const results = [];
    this.listPairs().forEach(({ primaryId, secondaryId, key }) => {
      const screening = this.screenPair(primaryId, secondaryId, nowMs, endMs);
      const datum = {
        utc: nowMs,
        pairKey: key,
        primary: primaryId,
        secondary: secondaryId,
        missKm: screening ? screening.missKm : NaN,
        tcaMs: screening ? screening.tcaMs : nowMs,
        tcaOffsetS: screening ? (screening.tcaMs - nowMs) / 1000 : NaN,
        pc: screening ? screening.pc : 0
      };
      results.push(datum);
      const buffer = this.history.get(`pair:${key}`);
      if (buffer) {
        pushCapped(buffer, datum, HISTORY_BUFFER_SIZE);
      }
    });
    return results;
  }

  emit(historyKey, datum) {
    const subs = this.subscribers.get(historyKey);
    if (!subs) {
      return;
    }
    subs.forEach((cb) => cb(datum));
  }

  tick() {
    const nowMs = this.now();
    this.trackedIds.forEach((id) => {
      const datum = this.propagateTracked(id, nowMs);
      const buffer = this.history.get(`tracked:${id}`);
      if (buffer) {
        pushCapped(buffer, datum, HISTORY_BUFFER_SIZE);
      }
      this.emit(`tracked:${id}`, datum);
    });
    const pairs = this.screenAllPairs(nowMs);
    pairs.forEach((datum) => {
      this.emit(`pair:${datum.pairKey}`, datum);
    });
    const summary = this.summarize(pairs, nowMs);
    const summaryBuffer = this.history.get('pair:summary');
    if (summaryBuffer) {
      pushCapped(summaryBuffer, summary, HISTORY_BUFFER_SIZE);
    }
    this.emit('pair:summary', summary);
  }

  summarize(pairDatums, nowMs) {
    let worst = null;
    pairDatums.forEach((datum) => {
      if (Number.isNaN(datum.missKm)) {
        return;
      }
      if (!worst || datum.pc > worst.pc || datum.missKm < worst.missKm) {
        worst = datum;
      }
    });
    if (!worst) {
      return {
        utc: nowMs,
        pairKey: 'summary',
        primary: '',
        secondary: '',
        missKm: Infinity,
        tcaOffsetS: NaN,
        pc: 0
      };
    }
    return {
      utc: nowMs,
      pairKey: 'summary',
      primary: worst.primary,
      secondary: worst.secondary,
      missKm: worst.missKm,
      tcaOffsetS: worst.tcaOffsetS,
      pc: worst.pc
    };
  }

  start() {
    if (this.timerId !== null) {
      return;
    }
    this.tick();
    this.timerId = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  subscribe(historyKey, callback) {
    if (!this.subscribers.has(historyKey)) {
      this.subscribers.set(historyKey, new Set());
    }
    this.subscribers.get(historyKey).add(callback);
    return () => {
      const subs = this.subscribers.get(historyKey);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  getHistory(historyKey, startMs, endMs) {
    const buffer = this.history.get(historyKey) ?? [];
    return buffer.filter((datum) => datum.utc >= startMs && datum.utc <= endMs);
  }
}

export { ConjunctionEngine, pairKey };
