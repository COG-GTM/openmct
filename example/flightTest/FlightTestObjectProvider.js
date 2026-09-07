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

import {
  EVENT_METADATA,
  EVENT_STREAM,
  FOLDERS,
  NAMESPACE,
  parameterMetadata,
  PARAMETERS_BY_KEY,
  parametersInGroup,
  ROOT_KEY,
  TEST_ARTICLE_KEY,
  TYPES
} from './parameters.js';

function identifierFor(key) {
  return { namespace: NAMESPACE, key };
}

function locationFor(key) {
  return `${NAMESPACE}:${key}`;
}

/**
 * Serves the static object tree for the test article:
 *
 *   Flight Test Telemetry
 *   └── Test Article TA-01
 *       ├── PCM Parameters
 *       ├── MIL-STD-1553 Bus Health
 *       ├── TSPI
 *       └── Test Card Events
 *
 * Every object carries a `composition` array so the default composition
 * provider can expand it, and every telemetry object carries its metadata
 * inline in `telemetry.values`.
 */
export default class FlightTestObjectProvider {
  constructor() {
    this.objects = new Map();

    this.addObject({
      identifier: identifierFor(ROOT_KEY),
      name: 'Flight Test Telemetry',
      type: 'folder',
      location: 'ROOT',
      composition: [identifierFor(TEST_ARTICLE_KEY)]
    });

    this.addObject({
      identifier: identifierFor(TEST_ARTICLE_KEY),
      name: 'Test Article TA-01',
      type: 'folder',
      location: locationFor(ROOT_KEY),
      notes:
        'Instrumented test article flying the TP-01 through TP-07 test card: climb, cruise, wind-up turn, bus health check, descent.',
      composition: FOLDERS.map((folder) => identifierFor(folder.key))
    });

    FOLDERS.forEach((folder) => {
      const children =
        folder.group === 'events'
          ? [identifierFor(EVENT_STREAM.key)]
          : parametersInGroup(folder.group).map((parameter) => identifierFor(parameter.key));

      this.addObject({
        identifier: identifierFor(folder.key),
        name: folder.name,
        type: 'folder',
        location: locationFor(TEST_ARTICLE_KEY),
        composition: children
      });
    });

    PARAMETERS_BY_KEY.forEach((parameter) => {
      const folder = FOLDERS.find((candidate) => candidate.group === parameter.group);

      this.addObject({
        identifier: identifierFor(parameter.key),
        name: parameter.name,
        type: TYPES.PARAMETER,
        location: locationFor(folder.key),
        notes: parameter.description,
        telemetry: parameterMetadata(parameter)
      });
    });

    const eventsFolder = FOLDERS.find((folder) => folder.group === 'events');
    this.addObject({
      identifier: identifierFor(EVENT_STREAM.key),
      name: EVENT_STREAM.name,
      type: TYPES.EVENTS,
      location: locationFor(eventsFolder.key),
      notes: EVENT_STREAM.description,
      telemetry: EVENT_METADATA
    });
  }

  addObject(domainObject) {
    this.objects.set(domainObject.identifier.key, domainObject);
  }

  get(identifier) {
    const domainObject = this.objects.get(identifier.key);

    if (domainObject === undefined) {
      return Promise.reject(new Error(`Unknown flight test object: ${identifier.key}`));
    }

    return Promise.resolve(structuredClone(domainObject));
  }
}
