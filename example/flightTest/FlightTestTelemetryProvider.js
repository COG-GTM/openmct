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

import { eventsBetween, sampleFlight } from './flightProfile.js';
import { PARAMETERS_BY_KEY, TYPES } from './parameters.js';

export const SAMPLE_PERIOD_MS = 1000;
export const MAX_REQUEST_DATUMS = 50000;
const EVENT_POLL_PERIOD_MS = 1000;

/**
 * Builds a telemetry datum for a parameter object at a point in time.
 */
export function parameterDatum(domainObject, timestamp) {
  const parameter = PARAMETERS_BY_KEY.get(domainObject.identifier.key);
  const state = sampleFlight(timestamp);

  return {
    id: domainObject.identifier.key,
    utc: timestamp,
    value: state[parameter.field],
    phase: state.phase
  };
}

/**
 * Historical and realtime telemetry for the test article. History is a
 * pure function of time (see flightProfile.js), so a request for any window
 * returns the same values every time and matches what a subscription
 * streamed while that window was live.
 */
export default class FlightTestTelemetryProvider {
  supportsRequest(domainObject) {
    return this.#isFlightTestTelemetry(domainObject);
  }

  supportsSubscribe(domainObject) {
    return this.#isFlightTestTelemetry(domainObject);
  }

  request(domainObject, options = {}) {
    if (domainObject.type === TYPES.EVENTS) {
      return Promise.resolve(this.#requestEvents(domainObject, options));
    }

    return Promise.resolve(this.#requestParameter(domainObject, options));
  }

  subscribe(domainObject, callback) {
    if (domainObject.type === TYPES.EVENTS) {
      return this.#subscribeEvents(domainObject, callback);
    }

    const interval = setInterval(() => {
      callback(parameterDatum(domainObject, Date.now()));
    }, SAMPLE_PERIOD_MS);

    return function unsubscribe() {
      clearInterval(interval);
    };
  }

  #requestParameter(domainObject, options) {
    const now = Date.now();
    const end = Math.min(options.end ?? now, now);
    const start = Math.min(options.start ?? end - SAMPLE_PERIOD_MS, end);
    const size = Math.min(options.size ?? MAX_REQUEST_DATUMS, MAX_REQUEST_DATUMS);
    const data = [];

    if (size <= 0) {
      return data;
    }

    const alignedStart = Math.ceil(start / SAMPLE_PERIOD_MS) * SAMPLE_PERIOD_MS;
    const alignedEnd = Math.floor(end / SAMPLE_PERIOD_MS) * SAMPLE_PERIOD_MS;

    if (alignedStart > alignedEnd) {
      return data;
    }

    const available = (alignedEnd - alignedStart) / SAMPLE_PERIOD_MS + 1;
    const count = Math.min(available, size);

    if (options.strategy === 'latest') {
      for (let i = count - 1; i >= 0; i--) {
        data.push(parameterDatum(domainObject, alignedEnd - i * SAMPLE_PERIOD_MS));
      }

      return data;
    }

    const step = count > 1 ? (alignedEnd - alignedStart) / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      data.push(parameterDatum(domainObject, Math.round(alignedStart + i * step)));
    }

    return data;
  }

  #requestEvents(domainObject, options) {
    const now = Date.now();
    const end = Math.min(options.end ?? now, now);
    const start = Math.min(options.start ?? 0, end);
    const size = Math.min(options.size ?? MAX_REQUEST_DATUMS, MAX_REQUEST_DATUMS);
    const events = eventsBetween(start, end).map((event) => this.#eventDatum(domainObject, event));

    if (size <= 0) {
      return [];
    }

    if (options.strategy === 'latest') {
      return events.slice(-1);
    }

    return events.slice(-size);
  }

  #subscribeEvents(domainObject, callback) {
    let lastEmitted = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();

      eventsBetween(lastEmitted + 1, now).forEach((event) => {
        callback(this.#eventDatum(domainObject, event));
      });
      lastEmitted = now;
    }, EVENT_POLL_PERIOD_MS);

    return function unsubscribe() {
      clearInterval(interval);
    };
  }

  #eventDatum(domainObject, event) {
    return {
      id: domainObject.identifier.key,
      ...event
    };
  }

  #isFlightTestTelemetry(domainObject) {
    return domainObject.type === TYPES.PARAMETER || domainObject.type === TYPES.EVENTS;
  }
}
