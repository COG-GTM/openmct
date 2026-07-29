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

// Screening thresholds commonly used for conjunction assessment triage.
const PC_CRITICAL = 1e-4;
const PC_WARNING = 1e-5;

const LIMITS = {
  critical: {
    cssClass: 'is-limit--upr is-limit--red',
    low: PC_CRITICAL,
    high: Number.POSITIVE_INFINITY,
    name: 'Pc Critical'
  },
  warning: {
    cssClass: 'is-limit--upr is-limit--yellow',
    low: PC_WARNING,
    high: PC_CRITICAL,
    name: 'Pc Warning'
  }
};

export default class ConjunctionLimitProvider {
  supportsLimits(domainObject) {
    return domainObject.type === 'udl.conjunctions';
  }

  getLimitEvaluator() {
    return {
      evaluate: function (datum, valueMetadata) {
        if (!valueMetadata || valueMetadata.key !== 'pc') {
          return undefined;
        }

        if (datum.pc >= PC_CRITICAL) {
          return LIMITS.critical;
        }

        if (datum.pc >= PC_WARNING) {
          return LIMITS.warning;
        }

        return undefined;
      }
    };
  }

  getLimits() {
    return {
      limits: function () {
        return Promise.resolve({
          WARNING: {
            high: {
              color: 'yellow',
              pc: PC_WARNING
            }
          },
          CRITICAL: {
            high: {
              color: 'red',
              pc: PC_CRITICAL
            }
          }
        });
      }
    };
  }
}
