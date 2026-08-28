import { KEYS, PAIR_TYPE, TRACKED_TYPE } from './models.js';

const TRACKED_PREFIX = 'tracked-';
const PAIR_PREFIX = 'pair-';

function historyKeyForObject(domainObject) {
  const key = domainObject.identifier.key;
  if (domainObject.type === TRACKED_TYPE && key.startsWith(TRACKED_PREFIX)) {
    return `tracked:${key.slice(TRACKED_PREFIX.length)}`;
  }
  if (domainObject.type === PAIR_TYPE) {
    if (key === KEYS.summary) {
      return 'pair:summary';
    }
    if (key.startsWith(PAIR_PREFIX)) {
      return `pair:${key.slice(PAIR_PREFIX.length)}`;
    }
  }
  return null;
}

class SsaTelemetryProvider {
  constructor(engine) {
    this.engine = engine;
  }

  supportsRequest(domainObject) {
    return historyKeyForObject(domainObject) !== null;
  }

  supportsSubscribe(domainObject) {
    return historyKeyForObject(domainObject) !== null;
  }

  request(domainObject, options = {}) {
    const historyKey = historyKeyForObject(domainObject);
    if (!historyKey) {
      return Promise.resolve([]);
    }
    const startMs = options.start ?? -Infinity;
    const endMs = options.end ?? Infinity;
    return Promise.resolve(this.engine.getHistory(historyKey, startMs, endMs));
  }

  subscribe(domainObject, callback) {
    const historyKey = historyKeyForObject(domainObject);
    if (!historyKey) {
      return () => {};
    }
    return this.engine.subscribe(historyKey, callback);
  }
}

export { historyKeyForObject };
export default SsaTelemetryProvider;
