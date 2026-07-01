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

import buildConditionSetConfiguration from './conditionSetConfig.js';
import ConjunctionEngine from './ConjunctionEngine.js';
import ConjunctionTelemetryProvider, {
  TRACKED_OBJECT_TYPE
} from './ConjunctionTelemetryProvider.js';
import {
  buildConditionWidgetConfiguration,
  buildLayoutConfiguration,
  buildOverlayPlotConfiguration,
  buildTableConfiguration
} from './layoutConfig.js';
import OrbitPropagator from './OrbitPropagator.js';
import SEED_OBJECTS from './seedObjects.js';

const NAMESPACE = 'conjunctionSSA';
const ROOT_KEY = 'ssa-root';
const CONDITION_SET_KEY = 'conjunction-watch';
const LAYOUT_KEY = 'operator-view';
const TABLE_KEY = 'conjunction-table';
const PLOT_KEY = 'conjunction-plot';
const STATUS_WIDGET_KEY = 'conjunction-status';

// Tracked object whose worst-case values drive the Conjunction Watch criteria.
const PRIMARY_TRACKED_KEY = 'starlink-1007';

/**
 * Telemetry metadata for a tracked object. The `utc` time value is required so
 * the time conductor works (the active time system key must be present). Range
 * hints order how values are surfaced by default in plots and tables.
 * @returns {{values: Object[]}}
 */
function buildTrackedObjectTelemetry() {
  return {
    values: [
      { key: 'utc', name: 'Time', format: 'utc', hints: { domain: 1 } },
      { key: 'lat', name: 'Latitude', unit: 'deg', hints: { range: 1 } },
      { key: 'lon', name: 'Longitude', unit: 'deg', hints: { range: 2 } },
      { key: 'alt', name: 'Altitude', unit: 'km', hints: { range: 3 } },
      { key: 'miss_distance_km', name: 'Miss Distance', unit: 'km', hints: { range: 4 } },
      { key: 'tca', name: 'Time of Closest Approach', format: 'utc' },
      {
        key: 'probability_of_collision',
        name: 'Probability of Collision',
        hints: { range: 5 }
      }
    ]
  };
}

/**
 * Open MCT plugin providing an end-to-end Space Situational Awareness (SSA)
 * conjunction-screening demo: TLE-driven tracked objects, live conjunction
 * telemetry, a condition set that classifies threat level, and an operator
 * display layout — all self-contained with no external dependencies.
 *
 * @param {Object} [options]
 * @returns {(openmct: import('openmct').OpenMCT) => void}
 */
export default function ConjunctionSSAPlugin(options = {}) {
  return function install(openmct) {
    function identifier(key) {
      return { namespace: NAMESPACE, key };
    }
    const rootIdentifier = identifier(ROOT_KEY);
    const rootLocation = openmct.objects.makeKeyString(rootIdentifier);

    // --- Orbit propagation + conjunction screening engine -------------------
    const trackedObjects = SEED_OBJECTS.map((seed) => ({
      key: seed.key,
      name: seed.name,
      category: seed.category,
      propagator: new OrbitPropagator(seed.tle, seed.name)
    }));
    const engine = new ConjunctionEngine(trackedObjects);

    const trackedIdentifiers = SEED_OBJECTS.map((seed) => identifier(seed.key));

    // --- Domain object type -------------------------------------------------
    openmct.types.addType(TRACKED_OBJECT_TYPE, {
      name: 'Tracked Object',
      description: 'A satellite or debris object tracked via TLE for conjunction screening.',
      cssClass: 'icon-object',
      creatable: false,
      initialize(obj) {
        obj.telemetry = buildTrackedObjectTelemetry();
      }
    });

    // --- Telemetry provider -------------------------------------------------
    openmct.telemetry.addProvider(new ConjunctionTelemetryProvider(engine));

    // --- Seeded object models -----------------------------------------------
    const conditionSet = buildConditionSetConfiguration({
      compositionIdentifiers: trackedIdentifiers,
      primaryIdentifier: identifier(PRIMARY_TRACKED_KEY)
    });
    const conditionSetIdentifier = identifier(CONDITION_SET_KEY);
    const layoutIdentifier = identifier(LAYOUT_KEY);
    const tableIdentifier = identifier(TABLE_KEY);
    const plotIdentifier = identifier(PLOT_KEY);
    const statusWidgetIdentifier = identifier(STATUS_WIDGET_KEY);
    const layoutLocation = openmct.objects.makeKeyString(layoutIdentifier);

    const table = buildTableConfiguration(trackedIdentifiers);
    const plot = buildOverlayPlotConfiguration(trackedIdentifiers);
    const statusWidget = buildConditionWidgetConfiguration({
      conditionSetIdentifier,
      conditionIds: conditionSet.conditionIds
    });
    const layout = buildLayoutConfiguration({
      tableIdentifier,
      plotIdentifier,
      widgetIdentifier: statusWidgetIdentifier
    });

    // Objects that live directly under the SSA root folder.
    const rootChildren = [...trackedIdentifiers, conditionSetIdentifier, layoutIdentifier];

    const seededModels = new Map();

    seededModels.set(ROOT_KEY, () => ({
      identifier: rootIdentifier,
      type: 'folder',
      name: 'Conjunction SSA',
      location: 'ROOT'
    }));

    SEED_OBJECTS.forEach((seed) => {
      seededModels.set(seed.key, () => ({
        identifier: identifier(seed.key),
        type: TRACKED_OBJECT_TYPE,
        name: seed.name,
        location: rootLocation,
        objectCategory: seed.category,
        telemetry: buildTrackedObjectTelemetry()
      }));
    });

    seededModels.set(CONDITION_SET_KEY, () => ({
      identifier: conditionSetIdentifier,
      type: 'conditionSet',
      name: 'Conjunction Watch',
      location: rootLocation,
      composition: conditionSet.composition,
      configuration: conditionSet.configuration,
      telemetry: {}
    }));

    seededModels.set(LAYOUT_KEY, () => ({
      identifier: layoutIdentifier,
      type: 'layout',
      name: 'Conjunction Operator View',
      location: rootLocation,
      composition: layout.composition,
      configuration: layout.configuration
    }));

    seededModels.set(TABLE_KEY, () => ({
      identifier: tableIdentifier,
      type: 'table',
      name: 'Ranked Conjunctions',
      location: layoutLocation,
      composition: table.composition,
      configuration: table.configuration
    }));

    seededModels.set(PLOT_KEY, () => ({
      identifier: plotIdentifier,
      type: 'telemetry.plot.overlay',
      name: 'Miss Distance vs. Time',
      location: layoutLocation,
      composition: plot.composition,
      configuration: plot.configuration
    }));

    seededModels.set(STATUS_WIDGET_KEY, () => ({
      identifier: statusWidgetIdentifier,
      type: 'conditionWidget',
      name: 'Conjunction Status',
      location: layoutLocation,
      label: statusWidget.label,
      conditionalLabel: statusWidget.conditionalLabel,
      configuration: statusWidget.configuration
    }));

    // --- Object + composition providers ------------------------------------
    openmct.objects.addRoot(rootIdentifier, openmct.priority.HIGH);

    openmct.objects.addProvider(NAMESPACE, {
      get(objectIdentifier) {
        const factory = seededModels.get(objectIdentifier.key);

        return Promise.resolve(factory ? factory() : undefined);
      }
    });

    openmct.composition.addProvider({
      appliesTo(domainObject) {
        return (
          domainObject.identifier.namespace === NAMESPACE &&
          domainObject.identifier.key === ROOT_KEY
        );
      },
      load() {
        return Promise.resolve(rootChildren.map((childIdentifier) => ({ ...childIdentifier })));
      }
    });

    if (options.debug) {
      openmct.conjunctionSSA = { engine, trackedObjects };
    }
  };
}
