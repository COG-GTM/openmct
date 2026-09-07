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

/**
 * Deterministic simulation of one flight-test sortie flown by the test
 * article. The sortie is a fixed 24 minute test card that repeats back to
 * back, aligned to the Unix epoch, so any timestamp maps to exactly one
 * point in the profile. Historical requests and realtime subscriptions both
 * sample the same function, which keeps history and live data consistent.
 *
 * Test card (minutes into the sortie):
 *   00:00 - 01:00  TP-01 takeoff roll and liftoff
 *   01:00 - 06:00  TP-01 climb to FL250
 *   06:00 - 12:00  TP-02/TP-03 level cruise, heading change, accel to 420 kt
 *   12:00 - 14:00  TP-04 wind-up turn (Nz and AOA driven through limits)
 *   14:00 - 17:00  recovery; MIL-STD-1553 Bus B degrades, fails, fails over
 *   17:00 - 22:00  TP-06 descent
 *   22:00 - 24:00  TP-07 approach and landing
 */

const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;

export const SORTIE_DURATION_MIN = 24;
export const SORTIE_DURATION_MS = SORTIE_DURATION_MIN * MINUTE_MS;

export const PHASES = [
  { key: 'TAKEOFF', name: 'Takeoff', start: 0, end: 1 },
  { key: 'CLIMB', name: 'Climb', start: 1, end: 6 },
  { key: 'CRUISE', name: 'Level cruise', start: 6, end: 12 },
  { key: 'WIND_UP_TURN', name: 'Wind-up turn', start: 12, end: 14 },
  { key: 'RECOVERY', name: 'Recovery', start: 14, end: 17 },
  { key: 'DESCENT', name: 'Descent', start: 17, end: 22 },
  { key: 'APPROACH', name: 'Approach and landing', start: 22, end: 24 }
];

export const BUS_STATUS = {
  NOMINAL: 0,
  DEGRADED: 1,
  FAILED: 2
};

export const BUS_STATUS_ENUMERATIONS = [
  { value: BUS_STATUS.NOMINAL, string: 'NOMINAL' },
  { value: BUS_STATUS.DEGRADED, string: 'DEGRADED' },
  { value: BUS_STATUS.FAILED, string: 'FAILED' }
];

/**
 * Test-point marks recorded on the test card, as offsets into the sortie.
 */
export const TEST_CARD_EVENTS = [
  { offsetMin: 0, testPoint: 'TP-01', category: 'TEST_POINT', message: 'TP-01 takeoff roll start' },
  { offsetMin: 0.75, testPoint: 'TP-01', category: 'TEST_POINT', message: 'TP-01 liftoff' },
  {
    offsetMin: 1,
    testPoint: 'TP-01',
    category: 'TEST_POINT',
    message: 'TP-01 gear up, climb schedule 300 kt'
  },
  {
    offsetMin: 6,
    testPoint: 'TP-02',
    category: 'TEST_POINT',
    message: 'TP-02 level off FL250, cruise setup'
  },
  {
    offsetMin: 7,
    testPoint: 'TP-02',
    category: 'TEST_POINT',
    message: 'TP-02 heading change 090 to 180'
  },
  { offsetMin: 10, testPoint: 'TP-03', category: 'TEST_POINT', message: 'TP-03 accel to 420 kt' },
  {
    offsetMin: 12,
    testPoint: 'TP-04',
    category: 'TEST_POINT',
    message: 'TP-04 wind-up turn 4g start'
  },
  {
    offsetMin: 13.35,
    testPoint: 'TP-04',
    category: 'EXCEEDANCE',
    message: 'TP-04 Nz exceedance, knock it off'
  },
  { offsetMin: 14, testPoint: 'TP-04', category: 'TEST_POINT', message: 'TP-04 complete' },
  {
    offsetMin: 15,
    testPoint: 'TP-05',
    category: 'BUS',
    message: 'Bus B degraded, word errors rising'
  },
  {
    offsetMin: 16,
    testPoint: 'TP-05',
    category: 'BUS',
    message: 'Bus B failed, no-response count rising'
  },
  { offsetMin: 16.5, testPoint: 'TP-05', category: 'BUS', message: 'Bus B failover' },
  { offsetMin: 17, testPoint: 'TP-06', category: 'TEST_POINT', message: 'TP-06 descent start' },
  { offsetMin: 17.5, testPoint: 'TP-05', category: 'BUS', message: 'Bus B restored' },
  { offsetMin: 22, testPoint: 'TP-07', category: 'TEST_POINT', message: 'TP-07 approach' },
  {
    offsetMin: 23.5,
    testPoint: 'TP-07',
    category: 'TEST_POINT',
    message: 'Touchdown, test card complete'
  }
];

// Keyframes are [minutesIntoSortie, value]; values are eased between keys.
const ALTITUDE_FT = [
  [0, 60],
  [0.75, 60],
  [1, 500],
  [6, 25000],
  [12, 25000],
  [12.5, 24800],
  [13.5, 23400],
  [14, 24000],
  [17, 25000],
  [22, 2000],
  [23.5, 60],
  [24, 60]
];

const AIRSPEED_KT = [
  [0, 0],
  [0.75, 150],
  [1, 180],
  [6, 320],
  [10, 350],
  [12, 420],
  [13.3, 380],
  [14, 360],
  [17, 340],
  [22, 180],
  [23.5, 130],
  [24, 0]
];

const PITCH_DEG = [
  [0, 0],
  [0.75, 0],
  [1, 12],
  [6, 10],
  [6.5, 3],
  [12, 3],
  [12.3, 8],
  [13.3, 14],
  [14, 3],
  [17, 2],
  [17.5, -4],
  [22, -3],
  [23.5, 5],
  [24, 0]
];

const ROLL_DEG = [
  [0, 0],
  [7, 0],
  [7.3, 30],
  [8, 30],
  [8.3, 0],
  [12, 0],
  [12.4, 55],
  [13.3, 78],
  [13.8, 30],
  [14, 0],
  [17, 0],
  [17.3, -30],
  [18, -30],
  [18.3, 0],
  [24, 0]
];

const HEADING_DEG = [
  [0, 90],
  [7, 90],
  [8.3, 180],
  [12, 180],
  [14, 540],
  [17, 540],
  [18.3, 630],
  [24, 630]
];

const NZ_G = [
  [0, 1],
  [0.75, 1],
  [1, 1.3],
  [1.3, 1],
  [6, 1],
  [6.3, 0.85],
  [6.6, 1],
  [7, 1],
  [7.3, 1.15],
  [8, 1.15],
  [8.3, 1],
  [12, 1],
  [12.4, 2],
  [12.9, 4],
  [13.2, 6],
  [13.35, 6.7],
  [13.5, 5],
  [13.8, 1.8],
  [14, 1],
  [17, 1],
  [17.3, 1.15],
  [18, 1.15],
  [18.3, 1],
  [23.5, 1.2],
  [23.6, 1],
  [24, 1]
];

const AOA_DEG = [
  [0, 2],
  [0.75, 8],
  [1, 12],
  [6, 9],
  [6.5, 4],
  [12, 3.5],
  [12.4, 6],
  [12.9, 12],
  [13.2, 22],
  [13.35, 26.5],
  [13.5, 18],
  [13.8, 7],
  [14, 4],
  [17, 4.5],
  [22, 7],
  [23.5, 11],
  [24, 3]
];

const N1_PERCENT = [
  [0, 25],
  [0.5, 98],
  [1, 100],
  [6, 96],
  [6.5, 82],
  [10, 82],
  [10.5, 90],
  [12, 90],
  [12.4, 100],
  [13.5, 102],
  [14, 85],
  [17, 82],
  [17.5, 55],
  [22, 60],
  [23.5, 70],
  [23.7, 30],
  [24, 25]
];

const EGT_C = [
  [0, 480],
  [0.5, 860],
  [1, 880],
  [6, 850],
  [6.5, 720],
  [10, 720],
  [10.5, 800],
  [12, 800],
  [12.4, 900],
  [13.4, 935],
  [14, 760],
  [17, 720],
  [17.5, 560],
  [22, 600],
  [23.5, 680],
  [23.7, 480],
  [24, 460]
];

const FUEL_FLOW_PPH = [
  [0, 900],
  [0.5, 9500],
  [1, 10500],
  [6, 8500],
  [6.5, 4200],
  [10, 4200],
  [10.5, 5800],
  [12, 5800],
  [12.4, 11000],
  [13.5, 12500],
  [14, 5000],
  [17, 4200],
  [17.5, 1800],
  [22, 2200],
  [23.5, 3000],
  [23.7, 900],
  [24, 850]
];

const BUS_A_MSG_RATE = [
  [0, 850],
  [16.5, 850],
  [16.6, 1620],
  [17.5, 1620],
  [17.6, 850],
  [24, 850]
];

const BUS_B_MSG_RATE = [
  [0, 770],
  [15, 770],
  [16, 740],
  [16.4, 600],
  [16.5, 0],
  [17.5, 0],
  [17.6, 770],
  [24, 770]
];

const BUS_B_WORD_ERRORS = [
  [0, 0],
  [14.8, 0],
  [15, 6],
  [15.9, 9],
  [16, 22],
  [16.4, 28],
  [16.5, 0],
  [24, 0]
];

const BUS_B_NO_RESPONSE = [
  [0, 0],
  [15.9, 0],
  [16, 4],
  [16.4, 14],
  [16.5, 0],
  [24, 0]
];

const INITIAL_FUEL_LB = 12000;
const RANGE_ORIGIN = { latitude: 36.9, longitude: -75.6 };
const WIND_FROM_DEG = 270;
const WIND_KT = 15;
const DEG_TO_RAD = Math.PI / 180;

function smoothstep(fraction) {
  return fraction * fraction * (3 - 2 * fraction);
}

/**
 * Piecewise interpolation between keyframes, eased with smoothstep so that
 * maneuver entries and exits are rounded like a hand-flown profile.
 */
export function interpolate(keyframes, minutes) {
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];

  if (minutes <= first[0]) {
    return first[1];
  }

  if (minutes >= last[0]) {
    return last[1];
  }

  for (let i = 1; i < keyframes.length; i++) {
    const [endMin, endValue] = keyframes[i];

    if (minutes <= endMin) {
      const [startMin, startValue] = keyframes[i - 1];
      const fraction = (minutes - startMin) / (endMin - startMin);

      return startValue + (endValue - startValue) * smoothstep(fraction);
    }
  }

  return last[1];
}

function ripple(seconds, periodSeconds, amplitude, phase = 0) {
  return amplitude * Math.sin((2 * Math.PI * seconds) / periodSeconds + phase);
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);

  return Math.round(value * factor) / factor;
}

function trueAirspeed(indicatedKt, altitudeFt) {
  return indicatedKt * (1 + altitudeFt / 60000);
}

function groundSpeedKt(minutes) {
  const heading = interpolate(HEADING_DEG, minutes);
  const tas = trueAirspeed(interpolate(AIRSPEED_KT, minutes), interpolate(ALTITUDE_FT, minutes));
  const windComponent = WIND_KT * Math.cos((heading - (WIND_FROM_DEG + 180)) * DEG_TO_RAD);

  return Math.max(0, tas + windComponent);
}

/**
 * The ground track and fuel burn are integrals of the keyframed profile.
 * They are integrated once per second over the whole sortie at module load
 * and then sampled, which keeps every lookup deterministic and cheap.
 */
function integrateSortie() {
  const seconds = SORTIE_DURATION_MIN * 60;
  const latitude = new Float64Array(seconds + 1);
  const longitude = new Float64Array(seconds + 1);
  const fuelUsed = new Float64Array(seconds + 1);

  latitude[0] = RANGE_ORIGIN.latitude;
  longitude[0] = RANGE_ORIGIN.longitude;
  fuelUsed[0] = 0;

  for (let s = 1; s <= seconds; s++) {
    const minutes = (s - 0.5) / 60;
    const heading = interpolate(HEADING_DEG, minutes) * DEG_TO_RAD;
    const nmPerSecond = groundSpeedKt(minutes) / 3600;
    const dLat = (nmPerSecond * Math.cos(heading)) / 60;
    const dLon = (nmPerSecond * Math.sin(heading)) / 60 / Math.cos(latitude[s - 1] * DEG_TO_RAD);

    latitude[s] = latitude[s - 1] + dLat;
    longitude[s] = longitude[s - 1] + dLon;
    fuelUsed[s] = fuelUsed[s - 1] + interpolate(FUEL_FLOW_PPH, minutes) / 3600;
  }

  return { latitude, longitude, fuelUsed };
}

const TRACK = integrateSortie();

function sampleTrack(series, seconds) {
  const clamped = Math.min(Math.max(seconds, 0), series.length - 1);
  const index = Math.floor(clamped);
  const fraction = clamped - index;

  if (index >= series.length - 1) {
    return series[series.length - 1];
  }

  return series[index] + (series[index + 1] - series[index]) * fraction;
}

export function busStatusFor(messageRate, wordErrors, noResponse) {
  if (messageRate < 100 || wordErrors >= 20 || noResponse >= 10) {
    return BUS_STATUS.FAILED;
  }

  if (wordErrors >= 5 || noResponse >= 1) {
    return BUS_STATUS.DEGRADED;
  }

  return BUS_STATUS.NOMINAL;
}

/**
 * @param {number} timestamp epoch milliseconds
 * @returns {number} epoch milliseconds at which the sortie containing
 *          `timestamp` started
 */
export function sortieStart(timestamp) {
  return timestamp - (timestamp % SORTIE_DURATION_MS);
}

export function sortieNumber(timestamp) {
  return Math.floor(timestamp / SORTIE_DURATION_MS);
}

export function phaseAt(minutes) {
  return PHASES.find((phase) => minutes >= phase.start && minutes < phase.end) ?? PHASES.at(-1);
}

/**
 * Samples the complete aircraft state at a point in time.
 *
 * @param {number} timestamp epoch milliseconds
 */
export function sampleFlight(timestamp) {
  const elapsedMs = timestamp - sortieStart(timestamp);
  const seconds = elapsedMs / SECOND_MS;
  const minutes = elapsedMs / MINUTE_MS;

  const altitude =
    interpolate(ALTITUDE_FT, minutes) + ripple(seconds, 7, 12) + ripple(seconds, 31, 20);
  const airspeed = interpolate(AIRSPEED_KT, minutes) + ripple(seconds, 5, 1.5, 1);
  const aoa = interpolate(AOA_DEG, minutes) + ripple(seconds, 3, 0.25, 2);
  const pitch = interpolate(PITCH_DEG, minutes) + ripple(seconds, 4, 0.4);
  const roll = interpolate(ROLL_DEG, minutes) + ripple(seconds, 6, 0.8, 1);
  const yaw = (interpolate(HEADING_DEG, minutes) + ripple(seconds, 9, 0.6, 2) + 360) % 360;
  const nz = interpolate(NZ_G, minutes) + ripple(seconds, 2.5, 0.04);
  const n1 = interpolate(N1_PERCENT, minutes) + ripple(seconds, 11, 0.3);
  const n2 = 58 + 0.43 * n1 + ripple(seconds, 13, 0.2, 1);
  const egt = interpolate(EGT_C, minutes) + ripple(seconds, 17, 4);
  const fuelFlow = interpolate(FUEL_FLOW_PPH, minutes) + ripple(seconds, 8, 40);
  const fuelQuantity = INITIAL_FUEL_LB - sampleTrack(TRACK.fuelUsed, seconds);

  const busAWordErrors = Math.floor(seconds) % 97 === 0 ? 1 : 0;
  const busAMessageRate = interpolate(BUS_A_MSG_RATE, minutes) + ripple(seconds, 4, 6);
  const busANoResponse = 0;

  const busBMessageRate = Math.max(
    0,
    interpolate(BUS_B_MSG_RATE, minutes) + ripple(seconds, 4, 6, 1)
  );
  const busBWordErrors = Math.round(interpolate(BUS_B_WORD_ERRORS, minutes));
  const busBNoResponse = Math.round(interpolate(BUS_B_NO_RESPONSE, minutes));

  return {
    utc: timestamp,
    sortie: sortieNumber(timestamp),
    elapsedSeconds: seconds,
    phase: phaseAt(minutes).key,
    altitude: round(altitude, 0),
    airspeed: round(airspeed, 1),
    aoa: round(aoa, 2),
    pitch: round(pitch, 2),
    roll: round(roll, 2),
    yaw: round(yaw, 2),
    nz: round(nz, 3),
    n1: round(n1, 1),
    n2: round(n2, 1),
    egt: round(egt, 0),
    fuelFlow: round(fuelFlow, 0),
    fuelQuantity: round(fuelQuantity, 0),
    latitude: round(sampleTrack(TRACK.latitude, seconds), 6),
    longitude: round(sampleTrack(TRACK.longitude, seconds), 6),
    tspiAltitude: round(altitude + 45 + ripple(seconds, 23, 6), 0),
    groundSpeed: round(groundSpeedKt(minutes) + ripple(seconds, 5, 1.5, 1), 1),
    busAMessageRate: round(busAMessageRate, 0),
    busAWordErrors,
    busANoResponse,
    busAStatus: busStatusFor(busAMessageRate, busAWordErrors, busANoResponse),
    busBMessageRate: round(busBMessageRate, 0),
    busBWordErrors,
    busBNoResponse,
    busBStatus: busStatusFor(busBMessageRate, busBWordErrors, busBNoResponse)
  };
}

/**
 * Test-card events whose timestamps fall within [start, end], in
 * chronological order, spanning as many sorties as the window covers.
 */
export function eventsBetween(start, end) {
  const events = [];

  if (!(end >= start)) {
    return events;
  }

  const firstSortie = sortieNumber(start);
  const lastSortie = sortieNumber(end);

  for (let sortie = firstSortie; sortie <= lastSortie; sortie++) {
    const base = sortie * SORTIE_DURATION_MS;

    TEST_CARD_EVENTS.forEach((event) => {
      const utc = base + Math.round(event.offsetMin * MINUTE_MS);

      if (utc >= start && utc <= end) {
        events.push({
          utc,
          sortie,
          testPoint: event.testPoint,
          category: event.category,
          message: event.message,
          phase: phaseAt(event.offsetMin).key
        });
      }
    });
  }

  return events;
}
