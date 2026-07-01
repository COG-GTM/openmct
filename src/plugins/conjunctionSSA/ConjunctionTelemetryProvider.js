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

const TRACKED_OBJECT_TYPE = 'conjunctionSSA.trackedObject';
const REALTIME_INTERVAL_MS = 1000; // emit live telemetry every second
const HISTORICAL_STEP_MS = 30 * 1000; // 30s cadence for historical series

/**
 * Telemetry provider for Conjunction SSA tracked objects.
 *
 * Real-time and historical telemetry are both derived on the fly from the
 * shared {@link ConjunctionEngine}, which owns the orbit propagators and the
 * conjunction screening logic. Each datum carries the object's geodetic
 * position (lat/lon/alt) together with the worst-case conjunction values the
 * object participates in (miss distance, time of closest approach, and a
 * simplified probability of collision).
 */
export default class ConjunctionTelemetryProvider {
  /**
   * @param {import('./ConjunctionEngine.js').default} engine
   */
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * @param {import('openmct').DomainObject} domainObject
   * @returns {string} the engine key for this domain object
   */
  static keyFor(domainObject) {
    return domainObject.identifier.key;
  }

  supportsSubscribe(domainObject) {
    return domainObject.type === TRACKED_OBJECT_TYPE;
  }

  supportsRequest(domainObject) {
    return domainObject.type === TRACKED_OBJECT_TYPE;
  }

  /**
   * Emit a fresh datum once per second computed from "now".
   * @param {import('openmct').DomainObject} domainObject
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(domainObject, callback) {
    const key = ConjunctionTelemetryProvider.keyFor(domainObject);

    const interval = setInterval(() => {
      const datum = this.engine.getObjectDatum(key, Date.now());
      if (datum) {
        callback(datum);
      }
    }, REALTIME_INTERVAL_MS);

    return function unsubscribe() {
      clearInterval(interval);
    };
  }

  /**
   * Generate a historical series between options.start and options.end at a
   * fixed cadence, sorted ascending by time.
   * @param {import('openmct').DomainObject} domainObject
   * @param {Object} options
   * @returns {Promise<Object[]>}
   */
  request(domainObject, options = {}) {
    const key = ConjunctionTelemetryProvider.keyFor(domainObject);
    const end = options.end ?? Date.now();
    const start = options.start ?? end - 60 * 60 * 1000;

    const data = [];
    for (let t = start; t <= end; t += HISTORICAL_STEP_MS) {
      const datum = this.engine.getObjectDatum(key, t);
      if (datum) {
        data.push(datum);
      }
    }

    data.sort((a, b) => a.utc - b.utc);

    return Promise.resolve(data);
  }
}

export { TRACKED_OBJECT_TYPE };
