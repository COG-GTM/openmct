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

import { EARTH_RADIUS_KM, MU_EARTH, SATELLITES } from './satellites.js';

const EPHEMERIS_PERIOD_MS = 1000;
const CONJUNCTION_PERIOD_MS = 5000;
const SECONDARY_OBJECTS = [
  'COSMOS 2251 DEB',
  'FENGYUN 1C DEB',
  'SL-16 R/B',
  'STARLINK-30452',
  'IRIDIUM 33 DEB'
];

function ephemerisDatum(satellite, timestamp) {
  const radiusKm = EARTH_RADIUS_KM + satellite.altitudeKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(radiusKm, 3) / MU_EARTH);
  const meanMotion = (2 * Math.PI) / periodSeconds;
  const theta = meanMotion * (timestamp / 1000) + (satellite.phaseDeg * Math.PI) / 180;
  const inclination = (satellite.inclinationDeg * Math.PI) / 180;

  const latitude = (Math.asin(Math.sin(inclination) * Math.sin(theta)) * 180) / Math.PI;
  const earthRotationDeg = ((timestamp / 1000) * 360) / 86164;
  const longitude =
    (((((Math.atan2(Math.cos(inclination) * Math.sin(theta), Math.cos(theta)) * 180) / Math.PI +
      satellite.raanDeg -
      earthRotationDeg) %
      360) +
      540) %
      360) -
    180;

  return {
    id: satellite.key,
    utc: timestamp,
    altitude: satellite.altitudeKm + Math.sin(theta * 3) * 2,
    latitude,
    longitude,
    velocity: Math.sqrt(MU_EARTH / radiusKm)
  };
}

function conjunctionDatum(timestamp) {
  const slot = Math.floor(timestamp / CONJUNCTION_PERIOD_MS);
  const wave = Math.abs(Math.sin(slot / 7));
  const pc = wave > 0.92 ? 0.0002 + wave / 2000 : wave / 50000;

  return {
    id: 'conjunctions',
    utc: timestamp,
    pc: Number(pc.toPrecision(3)),
    missDistance: Number((0.4 + (1 - wave) * 24).toFixed(2)),
    secondary: SECONDARY_OBJECTS[slot % SECONDARY_OBJECTS.length]
  };
}

export default class UDLTelemetryProvider {
  supportsRequest(domainObject) {
    return this.#isUDLTelemetry(domainObject);
  }

  supportsSubscribe(domainObject) {
    return this.#isUDLTelemetry(domainObject);
  }

  request(domainObject, options) {
    const period =
      domainObject.type === 'udl.conjunctions' ? CONJUNCTION_PERIOD_MS : EPHEMERIS_PERIOD_MS;
    const start = Math.floor(options.start / period) * period;
    const data = [];

    for (let timestamp = start; timestamp <= options.end; timestamp += period) {
      data.push(this.#datumFor(domainObject, timestamp));
    }

    return Promise.resolve(data);
  }

  subscribe(domainObject, callback) {
    const period =
      domainObject.type === 'udl.conjunctions' ? CONJUNCTION_PERIOD_MS : EPHEMERIS_PERIOD_MS;
    const interval = setInterval(() => {
      callback(this.#datumFor(domainObject, Date.now()));
    }, period);

    return function unsubscribe() {
      clearInterval(interval);
    };
  }

  #datumFor(domainObject, timestamp) {
    if (domainObject.type === 'udl.conjunctions') {
      return conjunctionDatum(timestamp);
    }

    const satellite = SATELLITES.find((candidate) => candidate.key === domainObject.identifier.key);

    return ephemerisDatum(satellite, timestamp);
  }

  #isUDLTelemetry(domainObject) {
    return domainObject.type === 'udl.ephemeris' || domainObject.type === 'udl.conjunctions';
  }
}
