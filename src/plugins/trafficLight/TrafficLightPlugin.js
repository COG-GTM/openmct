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

import TrafficLightCompositionPolicy from './TrafficLightCompositionPolicy.js';
import TrafficLightViewProvider from './TrafficLightViewProvider.js';

export default function () {
  return function install(openmct) {
    openmct.objectViews.addProvider(new TrafficLightViewProvider(openmct));
    openmct.types.addType('trafficLight', {
      name: 'Traffic Light',
      creatable: true,
      description:
        "Displays a telemetry point's alarm/limit status as a green/yellow/red indicator.",
      cssClass: 'icon-gauge',
      initialize(domainObject) {
        domainObject.composition = [];
        domainObject.configuration = {
          precision: 2,
          isDisplayCurVal: true,
          isDisplayUnits: true
        };
      },
      form: [
        {
          name: 'Display current value',
          control: 'toggleSwitch',
          cssClass: 'l-input',
          key: 'isDisplayCurVal',
          property: ['configuration', 'isDisplayCurVal']
        },
        {
          name: 'Display units',
          control: 'toggleSwitch',
          cssClass: 'l-input',
          key: 'isDisplayUnits',
          property: ['configuration', 'isDisplayUnits']
        },
        {
          name: 'Float precision',
          control: 'numberfield',
          cssClass: 'l-input-sm',
          key: 'precision',
          property: ['configuration', 'precision']
        }
      ]
    });
    openmct.composition.addPolicy(new TrafficLightCompositionPolicy(openmct).allow);
  };
}
