import { PAIR_TYPE, TRACKED_TYPE } from './models.js';

const TRACKED_VALUES = [
  { key: 'utc', name: 'Time', format: 'utc', hints: { domain: 1 } },
  { key: 'lat', name: 'Latitude', unit: 'deg', format: 'float', hints: { range: 1 } },
  { key: 'lon', name: 'Longitude', unit: 'deg', format: 'float', hints: { range: 2 } },
  { key: 'alt', name: 'Altitude', unit: 'km', format: 'float', hints: { range: 3 } },
  { key: 'speedKmS', name: 'Speed', unit: 'km/s', format: 'float', hints: { range: 4 } }
];

const PAIR_VALUES = [
  { key: 'utc', name: 'Time', format: 'utc', hints: { domain: 1 } },
  { key: 'pairKey', name: 'Pair', format: 'string' },
  { key: 'primary', name: 'Primary', format: 'string' },
  { key: 'secondary', name: 'Secondary', format: 'string' },
  { key: 'missKm', name: 'Miss Distance', unit: 'km', format: 'float', hints: { range: 1 } },
  { key: 'tcaOffsetS', name: 'TCA Offset', unit: 's', format: 'float', hints: { range: 2 } },
  { key: 'pc', name: 'Probability of Collision', format: 'float', hints: { range: 3 } }
];

class SsaMetadataProvider {
  supportsMetadata(domainObject) {
    return domainObject.type === TRACKED_TYPE || domainObject.type === PAIR_TYPE;
  }

  getMetadata(domainObject) {
    const values = domainObject.type === TRACKED_TYPE ? TRACKED_VALUES : PAIR_VALUES;
    return { ...domainObject.telemetry, values };
  }
}

export default SsaMetadataProvider;
