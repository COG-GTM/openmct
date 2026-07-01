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
 * Builders for the "Conjunction Operator View" display layout and its three
 * embedded child objects: a ranked telemetry table, a miss-distance overlay
 * plot, and a condition-set-driven status widget.
 */

// RED / YELLOW / GREEN styling for the status widget, keyed to condition ids.
const STATUS_COLORS = {
  red: { backgroundColor: '#980000', color: '#ffffff' },
  yellow: { backgroundColor: '#ff9900', color: '#000000' },
  green: { backgroundColor: '#38761d', color: '#ffffff' }
};

/**
 * Build a `table` (Telemetry Table) domain object model ranked by probability
 * of collision (descending).
 *
 * @param {import('openmct').Identifier[]} compositionIdentifiers
 * @returns {{composition: Object[], configuration: Object}}
 */
export function buildTableConfiguration(compositionIdentifiers) {
  return {
    composition: compositionIdentifiers.map((identifier) => ({ ...identifier })),
    configuration: {
      hiddenColumns: {},
      columnWidths: {},
      columnOrder: [],
      cellFormat: {},
      autosize: true,
      sortOptions: {
        key: 'probability_of_collision',
        direction: 'desc'
      }
    }
  };
}

/**
 * Build a `telemetry.plot.overlay` (Overlay Plot) domain object model of
 * miss distance vs. time.
 *
 * @param {import('openmct').Identifier[]} compositionIdentifiers
 * @returns {{composition: Object[], configuration: Object}}
 */
export function buildOverlayPlotConfiguration(compositionIdentifiers) {
  return {
    composition: compositionIdentifiers.map((identifier) => ({ ...identifier })),
    configuration: {
      series: compositionIdentifiers.map((identifier) => ({
        identifier: { ...identifier },
        yKey: 'miss_distance_km'
      })),
      yAxis: {
        label: 'Miss Distance (km)'
      },
      xAxis: {},
      legend: {
        position: 'top',
        showLegendsForChildren: false
      }
    }
  };
}

/**
 * Build a `conditionWidget` domain object model that uses the Conjunction
 * Watch condition set's output as its label and maps the RED/YELLOW/GREEN
 * conditions to background colors.
 *
 * @param {Object} params
 * @param {import('openmct').Identifier} params.conditionSetIdentifier
 * @param {{red: string, yellow: string, green: string}} params.conditionIds
 * @returns {Object} partial domain object (label, conditionalLabel, configuration)
 */
export function buildConditionWidgetConfiguration({ conditionSetIdentifier, conditionIds }) {
  function styleFor(conditionId, colors) {
    return {
      conditionId,
      style: {
        backgroundColor: colors.backgroundColor,
        border: '',
        color: colors.color,
        isStyleInvisible: ''
      }
    };
  }

  return {
    label: 'Conjunction Status',
    conditionalLabel: '',
    configuration: {
      useConditionSetOutputAsLabel: true,
      objectStyles: {
        styles: [
          styleFor(conditionIds.red, STATUS_COLORS.red),
          styleFor(conditionIds.yellow, STATUS_COLORS.yellow),
          styleFor(conditionIds.green, STATUS_COLORS.green)
        ],
        staticStyle: {
          style: {
            backgroundColor: '',
            border: '',
            color: ''
          }
        },
        selectedConditionId: conditionIds.green,
        defaultConditionId: conditionIds.green,
        conditionSetIdentifier: { ...conditionSetIdentifier }
      }
    }
  };
}

/**
 * Build the `layout` (Display Layout) "Conjunction Operator View" that arranges
 * the table, plot, and status widget.
 *
 * @param {Object} params
 * @param {import('openmct').Identifier} params.tableIdentifier
 * @param {import('openmct').Identifier} params.plotIdentifier
 * @param {import('openmct').Identifier} params.widgetIdentifier
 * @returns {{composition: Object[], configuration: Object}}
 */
export function buildLayoutConfiguration({ tableIdentifier, plotIdentifier, widgetIdentifier }) {
  function subobjectItem(identifier, x, y, width, height) {
    return {
      type: 'subobject-view',
      id: uuid(),
      identifier: { ...identifier },
      x,
      y,
      width,
      height,
      hasFrame: true
    };
  }

  return {
    composition: [{ ...widgetIdentifier }, { ...tableIdentifier }, { ...plotIdentifier }],
    configuration: {
      layoutGrid: [10, 10],
      items: [
        subobjectItem(widgetIdentifier, 0, 0, 20, 6),
        subobjectItem(tableIdentifier, 0, 6, 40, 16),
        subobjectItem(plotIdentifier, 40, 6, 40, 16)
      ]
    }
  };
}
