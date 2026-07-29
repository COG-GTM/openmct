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

import { SATELLITES } from './satellites.js';

const EPHEMERIS_VALUES = [
  {
    key: 'utc',
    source: 'utc',
    name: 'Timestamp',
    format: 'utc',
    hints: { domain: 1 }
  },
  {
    key: 'altitude',
    name: 'Altitude',
    unit: 'km',
    format: 'float',
    hints: { range: 1 }
  },
  {
    key: 'latitude',
    name: 'Latitude',
    unit: 'deg',
    format: 'float',
    hints: { range: 2 }
  },
  {
    key: 'longitude',
    name: 'Longitude',
    unit: 'deg',
    format: 'float',
    hints: { range: 3 }
  },
  {
    key: 'velocity',
    name: 'Velocity',
    unit: 'km/s',
    format: 'float',
    hints: { range: 4 }
  }
];

const CONJUNCTION_VALUES = [
  {
    key: 'utc',
    source: 'utc',
    name: 'Timestamp',
    format: 'utc',
    hints: { domain: 1 }
  },
  {
    key: 'pc',
    name: 'Probability of Collision',
    format: 'float',
    hints: { range: 1 }
  },
  {
    key: 'missDistance',
    name: 'Miss Distance',
    unit: 'km',
    format: 'float',
    hints: { range: 2 }
  },
  {
    key: 'secondary',
    name: 'Secondary Object',
    format: 'string',
    hints: { range: 3 }
  }
];

export default class UDLObjectProvider {
  get(identifier) {
    if (identifier.key === 'node') {
      return Promise.resolve({
        identifier,
        name: 'UDL Federation Node',
        type: 'folder',
        location: 'ROOT'
      });
    }

    if (identifier.key === 'conjunctions') {
      return Promise.resolve({
        identifier,
        name: 'Conjunction Assessments',
        type: 'udl.conjunctions',
        location: 'udl:node',
        telemetry: {
          values: CONJUNCTION_VALUES
        }
      });
    }

    const satellite = SATELLITES.find((candidate) => candidate.key === identifier.key);
    if (satellite === undefined) {
      return Promise.reject(new Error(`Unknown UDL object: ${identifier.key}`));
    }

    return Promise.resolve({
      identifier,
      name: satellite.name,
      type: 'udl.ephemeris',
      location: 'udl:node',
      noradId: satellite.noradId,
      telemetry: {
        values: EPHEMERIS_VALUES
      }
    });
  }
}
