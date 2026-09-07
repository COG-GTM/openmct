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

import { PARAMETERS_BY_KEY, TYPES } from './parameters.js';

export const LIMIT_LEVELS = {
  WARNING: {
    name: 'Warning High',
    cssClass: 'is-limit--upr is-limit--yellow',
    color: 'yellow'
  },
  CRITICAL: {
    name: 'Critical High',
    cssClass: 'is-limit--upr is-limit--red',
    color: 'red'
  }
};

/**
 * Classifies a value against a parameter's exceedance thresholds.
 *
 * @returns {'CRITICAL'|'WARNING'|undefined} the most severe band the value
 *          is in, or undefined when the value is within limits
 */
export function exceedanceLevel(parameter, value) {
  const limits = parameter?.limits;

  if (limits === undefined || typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  if (limits.CRITICAL !== undefined && value >= limits.CRITICAL.high) {
    return 'CRITICAL';
  }

  if (limits.WARNING !== undefined && value >= limits.WARNING.high) {
    return 'WARNING';
  }

  return undefined;
}

/**
 * Warning and critical exceedance limits for the test article's monitored
 * parameters. Telemetry tables use the evaluator to color cells; plots use
 * `getLimits` to draw limit lines. Only parameters with limits defined in
 * parameters.js are supported.
 */
export default class FlightTestLimitProvider {
  supportsLimits(domainObject) {
    return domainObject.type === TYPES.PARAMETER && this.#parameterFor(domainObject) !== undefined;
  }

  getLimitEvaluator(domainObject) {
    const parameter = this.#parameterFor(domainObject);

    return {
      evaluate(datum, valueMetadata) {
        const rangeKey = valueMetadata?.key ?? 'value';

        if (rangeKey !== 'value') {
          return undefined;
        }

        const level = exceedanceLevel(parameter, datum[rangeKey]);

        if (level === undefined) {
          return undefined;
        }

        const limit = parameter.limits[level];
        const next = level === 'WARNING' ? parameter.limits.CRITICAL : undefined;

        return {
          name: LIMIT_LEVELS[level].name,
          cssClass: LIMIT_LEVELS[level].cssClass,
          low: limit.high,
          high: next !== undefined ? next.high : Number.POSITIVE_INFINITY
        };
      }
    };
  }

  getLimits(domainObject) {
    const parameter = this.#parameterFor(domainObject);

    return {
      limits() {
        const limits = {};

        Object.keys(parameter.limits).forEach((level) => {
          limits[level] = {
            high: {
              color: LIMIT_LEVELS[level].color,
              value: parameter.limits[level].high
            }
          };
        });

        return Promise.resolve(limits);
      }
    };
  }

  #parameterFor(domainObject) {
    const parameter = PARAMETERS_BY_KEY.get(domainObject.identifier?.key);

    return parameter?.limits === undefined ? undefined : parameter;
  }
}
