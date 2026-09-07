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

import FlightTestFaultProvider from './FlightTestFaultProvider.js';
import FlightTestLimitProvider from './FlightTestLimitProvider.js';
import FlightTestObjectProvider from './FlightTestObjectProvider.js';
import FlightTestTelemetryProvider from './FlightTestTelemetryProvider.js';
import { NAMESPACE, ROOT_KEY, TYPES } from './parameters.js';

/**
 * Example plugin for aircraft flight-test and mission-systems integration
 * telemetry. Adds a "Flight Test Telemetry" root containing a fictional test
 * article with PCM parameters, MIL-STD-1553 bus health, TSPI and a test-card
 * event stream, backed by a deterministic simulated sortie. Exceedances are
 * flagged through limits and published to Fault Management.
 *
 * Enable with:
 *
 *   openmct.install(openmct.plugins.example.FlightTest());
 *
 * Fault Management also requires `openmct.install(openmct.plugins.FaultManagement())`
 * and a Fault Management object to view the faults.
 */
export default function FlightTestPlugin(options = {}) {
  return function install(openmct) {
    openmct.types.addType(TYPES.PARAMETER, {
      name: 'Flight Test Parameter',
      description: 'A measurand recorded from the test article instrumentation system.',
      cssClass: 'icon-telemetry'
    });

    openmct.types.addType(TYPES.EVENTS, {
      name: 'Test Card Event Stream',
      description: 'Test-point marks and events logged during the sortie.',
      cssClass: 'icon-generator-events'
    });

    openmct.objects.addRoot({ namespace: NAMESPACE, key: ROOT_KEY });
    openmct.objects.addProvider(NAMESPACE, new FlightTestObjectProvider());

    openmct.telemetry.addProvider(new FlightTestTelemetryProvider());
    openmct.telemetry.addProvider(new FlightTestLimitProvider());

    const faultProvider = new FlightTestFaultProvider(options.faults);
    openmct.faults.addProvider(faultProvider);

    openmct.on('start', () => faultProvider.start());
    openmct.on('destroy', () => faultProvider.stop());
  };
}
