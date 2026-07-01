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
import { v4 as uuid } from 'uuid';

/**
 * Output labels for the Conjunction Watch condition set. These strings are the
 * outputs of each condition and are what the operator view / condition widget
 * displays and styles (RED / YELLOW / GREEN).
 */
export const CONJUNCTION_OUTPUT = {
  RED: 'Maneuver review',
  YELLOW: 'Watch',
  GREEN: 'Clear'
};

// Screening thresholds (km / probability).
const RED_MISS_DISTANCE_KM = 5;
const RED_PROBABILITY = 0.0001;
const YELLOW_MISS_DISTANCE_KM = 25;

/**
 * Build the `conditionSet` domain object model for "Conjunction Watch".
 *
 * Condition order matters — the first matching condition wins:
 *   1. RED    (`Maneuver review`): miss_distance_km < 5 AND Pc > 1e-4
 *   2. YELLOW (`Watch`):           miss_distance_km < 25
 *   3. GREEN  (`Clear`, default)
 *
 * @param {Object} params
 * @param {import('openmct').Identifier[]} params.compositionIdentifiers
 *        tracked-object identifiers referenced by the condition set
 * @param {import('openmct').Identifier} params.primaryIdentifier
 *        tracked object whose telemetry drives the criteria
 * @returns {{composition: Object[], configuration: Object}}
 */
export default function buildConditionSetConfiguration({
  compositionIdentifiers,
  primaryIdentifier
}) {
  const telemetryRef = {
    namespace: primaryIdentifier.namespace,
    key: primaryIdentifier.key
  };

  const redId = uuid();
  const yellowId = uuid();
  const greenId = uuid();

  const redCondition = {
    isDefault: false,
    id: redId,
    configuration: {
      name: 'Maneuver review',
      output: CONJUNCTION_OUTPUT.RED,
      trigger: 'all',
      criteria: [
        {
          id: uuid(),
          telemetry: telemetryRef,
          operation: 'lessThan',
          input: [`${RED_MISS_DISTANCE_KM}`],
          metadata: 'miss_distance_km'
        },
        {
          id: uuid(),
          telemetry: telemetryRef,
          operation: 'greaterThan',
          input: [`${RED_PROBABILITY}`],
          metadata: 'probability_of_collision'
        }
      ]
    },
    summary: `Match if all criteria are met: miss distance < ${RED_MISS_DISTANCE_KM} km and probability of collision > ${RED_PROBABILITY}`
  };

  const yellowCondition = {
    isDefault: false,
    id: yellowId,
    configuration: {
      name: 'Watch',
      output: CONJUNCTION_OUTPUT.YELLOW,
      trigger: 'all',
      criteria: [
        {
          id: uuid(),
          telemetry: telemetryRef,
          operation: 'lessThan',
          input: [`${YELLOW_MISS_DISTANCE_KM}`],
          metadata: 'miss_distance_km'
        }
      ]
    },
    summary: `Match if all criteria are met: miss distance < ${YELLOW_MISS_DISTANCE_KM} km`
  };

  const defaultCondition = {
    isDefault: true,
    id: greenId,
    configuration: {
      name: 'Clear',
      output: CONJUNCTION_OUTPUT.GREEN,
      trigger: 'all',
      criteria: []
    },
    summary: 'Default condition'
  };

  return {
    conditionIds: { red: redId, yellow: yellowId, green: greenId },
    composition: compositionIdentifiers.map((identifier) => ({ ...identifier })),
    configuration: {
      shouldFetchHistorical: false,
      conditionTestData: [],
      conditionCollection: [redCondition, yellowCondition, defaultCondition]
    }
  };
}
