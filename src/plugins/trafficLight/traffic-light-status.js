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

export const STATUS = Object.freeze({
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  GRAY: 'gray'
});

const RED_TOKENS = ['red', 'purple', 'orange', 'critical', 'distress', 'severe'];

const RED_LEVELS = ['SEVERE', 'CRITICAL', 'DISTRESS'];
const YELLOW_LEVELS = ['WARNING'];

function containsToken(text, tokens) {
  if (!text) {
    return false;
  }

  const lower = String(text).toLowerCase();

  return tokens.some((token) => lower.includes(token));
}

/**
 * Map the result of a LimitEvaluator's evaluate() call to a traffic light status.
 * Any limit violation whose severity cannot be recognized is treated as a warning.
 * @param {{cssClass?: string, name?: string} | undefined} limit
 * @returns {string | undefined} STATUS.RED, STATUS.YELLOW, or undefined when the
 *   evaluation carried no limit violation
 */
export function statusFromLimitEvaluation(limit) {
  if (!limit) {
    return undefined;
  }

  if (containsToken(limit.cssClass, RED_TOKENS) || containsToken(limit.name, RED_TOKENS)) {
    return STATUS.RED;
  }

  return STATUS.YELLOW;
}

function boundFor(bound, valueKeys) {
  if (!bound) {
    return undefined;
  }

  const key = valueKeys.find((valueKey) => typeof bound[valueKey] === 'number');

  return key === undefined ? undefined : bound[key];
}

function violates(level, value, valueKeys) {
  if (!level) {
    return false;
  }

  const low = boundFor(level.low, valueKeys);
  const high = boundFor(level.high, valueKeys);
  const belowLow = low !== undefined && value < low;
  const aboveHigh = high !== undefined && value > high;

  return belowLow || aboveHigh;
}

/**
 * Compare a numeric value against a limits definition (as returned by
 * openmct.telemetry.getLimits(...).limits()) and return a traffic light status.
 * @param {object | undefined} limitDefinition
 * @param {number} value
 * @param {string | string[]} valueKey the value's metadata key (or candidate keys, e.g. key and source)
 * @returns {string | undefined} STATUS.RED, STATUS.YELLOW, or undefined when in bounds
 */
export function statusFromLimitDefinition(limitDefinition, value, valueKey) {
  if (!limitDefinition || typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  const valueKeys = (Array.isArray(valueKey) ? valueKey : [valueKey]).filter(
    (key) => key !== undefined && key !== null
  );

  if (RED_LEVELS.some((level) => violates(limitDefinition[level], value, valueKeys))) {
    return STATUS.RED;
  }

  if (YELLOW_LEVELS.some((level) => violates(limitDefinition[level], value, valueKeys))) {
    return STATUS.YELLOW;
  }

  return undefined;
}

/**
 * Resolve the overall traffic light status. Severity levels from the limits
 * definition take precedence; the limit evaluator's result is used when the
 * definition is absent or not violated.
 * @param {object} options
 * @param {boolean} options.hasData whether a datum has been received
 * @param {boolean} options.isStale whether the telemetry is stale
 * @param {{cssClass?: string, name?: string} | undefined} options.limitEvaluation
 * @param {object | undefined} options.limitDefinition
 * @param {number} options.value
 * @param {string | string[]} options.valueKey
 * @returns {string} one of STATUS
 */
export function resolveStatus({
  hasData,
  isStale,
  limitEvaluation,
  limitDefinition,
  value,
  valueKey
}) {
  if (!hasData || isStale) {
    return STATUS.GRAY;
  }

  return (
    statusFromLimitDefinition(limitDefinition, value, valueKey) ??
    statusFromLimitEvaluation(limitEvaluation) ??
    STATUS.GREEN
  );
}
