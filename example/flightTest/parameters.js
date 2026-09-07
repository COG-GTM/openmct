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

import { BUS_STATUS_ENUMERATIONS } from './flightProfile.js';

export const NAMESPACE = 'flight-test';
export const ROOT_KEY = 'root';
export const TEST_ARTICLE_KEY = 'ta-01';

export const TYPES = {
  PARAMETER: 'flight-test.parameter',
  EVENTS: 'flight-test.events'
};

export const FOLDERS = [
  { key: 'ta-01.pcm', name: 'PCM Parameters', group: 'pcm' },
  { key: 'ta-01.bus', name: 'MIL-STD-1553 Bus Health', group: 'bus' },
  { key: 'ta-01.tspi', name: 'TSPI', group: 'tspi' },
  { key: 'ta-01.events', name: 'Test Card Events', group: 'events' }
];

/**
 * Exceedance thresholds. `high` values are inclusive: a value at or above
 * the threshold is in that limit band.
 */
const NZ_LIMITS = { WARNING: { high: 5.5 }, CRITICAL: { high: 6.5 } };
const AOA_LIMITS = { WARNING: { high: 20 }, CRITICAL: { high: 25 } };
const EGT_LIMITS = { WARNING: { high: 900 }, CRITICAL: { high: 950 } };
const WORD_ERROR_LIMITS = { WARNING: { high: 5 }, CRITICAL: { high: 20 } };

/**
 * Every measurand exposed by the test article. `field` names the property
 * of the sampled flight state (see flightProfile.js) that feeds the value.
 */
export const PARAMETERS = [
  {
    key: 'ta-01.pcm.altitude',
    group: 'pcm',
    name: 'Pressure Altitude',
    field: 'altitude',
    unit: 'ft',
    formatString: '%0.0f',
    description: 'Pressure altitude from the air data computer, 29.92 inHg reference.'
  },
  {
    key: 'ta-01.pcm.airspeed',
    group: 'pcm',
    name: 'Indicated Airspeed',
    field: 'airspeed',
    unit: 'kt',
    formatString: '%0.1f',
    description: 'Indicated airspeed from the pitot-static system.'
  },
  {
    key: 'ta-01.pcm.aoa',
    group: 'pcm',
    name: 'Angle of Attack',
    field: 'aoa',
    unit: 'deg',
    formatString: '%0.2f',
    limits: AOA_LIMITS,
    description: 'Fuselage-referenced angle of attack from the nose boom vane.'
  },
  {
    key: 'ta-01.pcm.pitch',
    group: 'pcm',
    name: 'Pitch Attitude',
    field: 'pitch',
    unit: 'deg',
    formatString: '%0.2f',
    description: 'Pitch attitude from the inertial reference unit.'
  },
  {
    key: 'ta-01.pcm.roll',
    group: 'pcm',
    name: 'Roll Attitude',
    field: 'roll',
    unit: 'deg',
    formatString: '%0.2f',
    description: 'Roll attitude from the inertial reference unit, right wing down positive.'
  },
  {
    key: 'ta-01.pcm.yaw',
    group: 'pcm',
    name: 'Yaw / Heading',
    field: 'yaw',
    unit: 'deg',
    formatString: '%0.2f',
    description: 'True heading from the inertial reference unit.'
  },
  {
    key: 'ta-01.pcm.nz',
    group: 'pcm',
    name: 'Normal Load Factor (Nz)',
    field: 'nz',
    unit: 'g',
    formatString: '%0.3f',
    limits: NZ_LIMITS,
    description: 'Normal acceleration at the center of gravity.'
  },
  {
    key: 'ta-01.pcm.n1',
    group: 'pcm',
    name: 'Engine N1',
    field: 'n1',
    unit: '%',
    formatString: '%0.1f',
    description: 'Low-pressure compressor speed, percent of rated.'
  },
  {
    key: 'ta-01.pcm.n2',
    group: 'pcm',
    name: 'Engine N2',
    field: 'n2',
    unit: '%',
    formatString: '%0.1f',
    description: 'High-pressure compressor speed, percent of rated.'
  },
  {
    key: 'ta-01.pcm.egt',
    group: 'pcm',
    name: 'Exhaust Gas Temperature',
    field: 'egt',
    unit: '°C',
    formatString: '%0.0f',
    limits: EGT_LIMITS,
    description: 'Turbine exhaust gas temperature.'
  },
  {
    key: 'ta-01.pcm.fuel-flow',
    group: 'pcm',
    name: 'Fuel Flow',
    field: 'fuelFlow',
    unit: 'pph',
    formatString: '%0.0f',
    description: 'Engine fuel flow, pounds per hour.'
  },
  {
    key: 'ta-01.pcm.fuel-quantity',
    group: 'pcm',
    name: 'Fuel Quantity',
    field: 'fuelQuantity',
    unit: 'lb',
    formatString: '%0.0f',
    description: 'Total usable fuel remaining.'
  },
  {
    key: 'ta-01.bus.a.message-rate',
    group: 'bus',
    name: 'Bus A Message Rate',
    field: 'busAMessageRate',
    bus: 'A',
    unit: 'msg/s',
    formatString: '%0.0f',
    description: 'MIL-STD-1553 messages per second observed on Bus A.'
  },
  {
    key: 'ta-01.bus.a.word-errors',
    group: 'bus',
    name: 'Bus A Word Errors',
    field: 'busAWordErrors',
    bus: 'A',
    unit: 'err/s',
    formatString: '%0.0f',
    limits: WORD_ERROR_LIMITS,
    description: 'Manchester, sync and parity word errors per second on Bus A.'
  },
  {
    key: 'ta-01.bus.a.no-response',
    group: 'bus',
    name: 'Bus A No-Response Count',
    field: 'busANoResponse',
    bus: 'A',
    unit: 'count/s',
    formatString: '%0.0f',
    description: 'Remote terminal response timeouts per second on Bus A.'
  },
  {
    key: 'ta-01.bus.a.status',
    group: 'bus',
    name: 'Bus A Status',
    field: 'busAStatus',
    bus: 'A',
    format: 'enum',
    enumerations: BUS_STATUS_ENUMERATIONS,
    description: 'Bus A health summary derived from error and response counters.'
  },
  {
    key: 'ta-01.bus.b.message-rate',
    group: 'bus',
    name: 'Bus B Message Rate',
    field: 'busBMessageRate',
    bus: 'B',
    unit: 'msg/s',
    formatString: '%0.0f',
    description: 'MIL-STD-1553 messages per second observed on Bus B.'
  },
  {
    key: 'ta-01.bus.b.word-errors',
    group: 'bus',
    name: 'Bus B Word Errors',
    field: 'busBWordErrors',
    bus: 'B',
    unit: 'err/s',
    formatString: '%0.0f',
    limits: WORD_ERROR_LIMITS,
    description: 'Manchester, sync and parity word errors per second on Bus B.'
  },
  {
    key: 'ta-01.bus.b.no-response',
    group: 'bus',
    name: 'Bus B No-Response Count',
    field: 'busBNoResponse',
    bus: 'B',
    unit: 'count/s',
    formatString: '%0.0f',
    description: 'Remote terminal response timeouts per second on Bus B.'
  },
  {
    key: 'ta-01.bus.b.status',
    group: 'bus',
    name: 'Bus B Status',
    field: 'busBStatus',
    bus: 'B',
    format: 'enum',
    enumerations: BUS_STATUS_ENUMERATIONS,
    description: 'Bus B health summary derived from error and response counters.'
  },
  {
    key: 'ta-01.tspi.latitude',
    group: 'tspi',
    name: 'Latitude',
    field: 'latitude',
    unit: 'deg',
    formatString: '%0.6f',
    description: 'WGS-84 latitude from the range tracking solution.'
  },
  {
    key: 'ta-01.tspi.longitude',
    group: 'tspi',
    name: 'Longitude',
    field: 'longitude',
    unit: 'deg',
    formatString: '%0.6f',
    description: 'WGS-84 longitude from the range tracking solution.'
  },
  {
    key: 'ta-01.tspi.altitude',
    group: 'tspi',
    name: 'Geometric Altitude',
    field: 'tspiAltitude',
    unit: 'ft',
    formatString: '%0.0f',
    description: 'Height above the WGS-84 ellipsoid from the range tracking solution.'
  },
  {
    key: 'ta-01.tspi.ground-speed',
    group: 'tspi',
    name: 'Ground Speed',
    field: 'groundSpeed',
    unit: 'kt',
    formatString: '%0.1f',
    description: 'Ground speed from the range tracking solution.'
  }
];

export const EVENT_STREAM = {
  key: 'ta-01.events.test-card',
  name: 'Test Card Events',
  description: 'Test-point marks, exceedance calls and bus events logged by the test conductor.'
};

export const PARAMETERS_BY_KEY = new Map(PARAMETERS.map((parameter) => [parameter.key, parameter]));

export function parametersInGroup(group) {
  return PARAMETERS.filter((parameter) => parameter.group === group);
}

export function parametersWithLimits() {
  return PARAMETERS.filter((parameter) => parameter.limits !== undefined);
}

/**
 * Telemetry metadata for a parameter object. Every parameter uses `value`
 * as its single range key so the limit evaluator and plot limit lines can
 * treat all parameters uniformly.
 */
export function parameterMetadata(parameter) {
  const valueMetadata = {
    key: 'value',
    name: parameter.name,
    hints: { range: 1 }
  };

  if (parameter.unit !== undefined) {
    valueMetadata.unit = parameter.unit;
  }

  if (parameter.formatString !== undefined) {
    valueMetadata.formatString = parameter.formatString;
  }

  if (parameter.format !== undefined) {
    valueMetadata.format = parameter.format;
  }

  if (parameter.enumerations !== undefined) {
    valueMetadata.enumerations = parameter.enumerations;
  }

  return {
    values: [
      {
        key: 'utc',
        source: 'utc',
        name: 'Time',
        format: 'utc',
        hints: { domain: 1 }
      },
      valueMetadata,
      {
        key: 'phase',
        name: 'Flight Phase',
        format: 'string'
      }
    ]
  };
}

export const EVENT_METADATA = {
  values: [
    {
      key: 'utc',
      source: 'utc',
      name: 'Time',
      format: 'utc',
      hints: { domain: 1 }
    },
    {
      key: 'message',
      name: 'Message',
      format: 'string',
      hints: { label: 0 }
    },
    {
      key: 'testPoint',
      name: 'Test Point',
      format: 'string'
    },
    {
      key: 'category',
      name: 'Category',
      format: 'string'
    },
    {
      key: 'phase',
      name: 'Flight Phase',
      format: 'string'
    }
  ]
};
