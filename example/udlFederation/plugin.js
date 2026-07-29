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

import ConjunctionLimitProvider from './ConjunctionLimitProvider.js';
import { SATELLITES } from './satellites.js';
import UDLObjectProvider from './UDLObjectProvider.js';
import UDLTelemetryProvider from './UDLTelemetryProvider.js';

/**
 * Simulated Unified Data Library (UDL) federation node. Exposes a
 * constellation's ephemeris streams and a conjunction-assessment feed the way
 * a UDL data-integration node would federate them into a mission-ops tool.
 */
export default function UDLFederationPlugin() {
  return function install(openmct) {
    openmct.types.addType('udl.ephemeris', {
      name: 'UDL Ephemeris',
      description: 'Satellite state vectors federated from a Unified Data Library node.',
      cssClass: 'icon-telemetry'
    });

    openmct.types.addType('udl.conjunctions', {
      name: 'UDL Conjunction Assessments',
      description:
        'Conjunction data messages federated from a Unified Data Library node, with probability-of-collision screening limits.',
      cssClass: 'icon-alert-triangle'
    });

    openmct.objects.addRoot({
      namespace: 'udl',
      key: 'node'
    });

    openmct.objects.addProvider('udl', new UDLObjectProvider());

    openmct.composition.addProvider({
      appliesTo: function (domainObject) {
        return domainObject.identifier.namespace === 'udl' && domainObject.type === 'folder';
      },
      load: function () {
        return Promise.resolve(
          SATELLITES.map((satellite) => ({
            namespace: 'udl',
            key: satellite.key
          })).concat([{ namespace: 'udl', key: 'conjunctions' }])
        );
      }
    });

    openmct.telemetry.addProvider(new UDLTelemetryProvider());
    openmct.telemetry.addProvider(new ConjunctionLimitProvider());
  };
}
