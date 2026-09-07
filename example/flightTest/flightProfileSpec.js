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
  BUS_STATUS,
  busStatusFor,
  eventsBetween,
  interpolate,
  phaseAt,
  PHASES,
  sampleFlight,
  SORTIE_DURATION_MS,
  sortieStart,
  TEST_CARD_EVENTS
} from './flightProfile.js';

const MINUTE_MS = 60_000;
const SORTIE_BASE = 1_000 * SORTIE_DURATION_MS;

function at(minutes) {
  return SORTIE_BASE + Math.round(minutes * MINUTE_MS);
}

describe('The flight test profile', () => {
  it('interpolates between keyframes and clamps outside them', () => {
    const keyframes = [
      [0, 0],
      [10, 100]
    ];

    expect(interpolate(keyframes, -5)).toBe(0);
    expect(interpolate(keyframes, 0)).toBe(0);
    expect(interpolate(keyframes, 5)).toBeCloseTo(50, 6);
    expect(interpolate(keyframes, 10)).toBe(100);
    expect(interpolate(keyframes, 15)).toBe(100);
    expect(interpolate(keyframes, 2.5)).toBeLessThan(25);
    expect(interpolate(keyframes, 7.5)).toBeGreaterThan(75);
  });

  it('is deterministic for a given timestamp', () => {
    const timestamp = at(13.3);

    expect(sampleFlight(timestamp)).toEqual(sampleFlight(timestamp));

    const { utc, sortie, ...state } = sampleFlight(timestamp);
    const {
      utc: nextUtc,
      sortie: nextSortie,
      ...nextState
    } = sampleFlight(timestamp + SORTIE_DURATION_MS);

    expect(nextState).toEqual(state);
    expect(nextUtc).toBe(utc + SORTIE_DURATION_MS);
    expect(nextSortie).toBe(sortie + 1);
  });

  it('aligns sorties to a fixed period', () => {
    expect(sortieStart(SORTIE_BASE + 12345)).toBe(SORTIE_BASE);
    expect(sampleFlight(SORTIE_BASE).elapsedSeconds).toBe(0);
    expect(sampleFlight(SORTIE_BASE - 1).elapsedSeconds).toBeCloseTo(
      SORTIE_DURATION_MS / 1000 - 0.001,
      3
    );
  });

  it('walks through every flight phase in order', () => {
    const observed = [];

    for (let minute = 0; minute < 24; minute += 0.5) {
      const phase = sampleFlight(at(minute)).phase;

      if (observed.at(-1) !== phase) {
        observed.push(phase);
      }
    }

    expect(observed).toEqual(PHASES.map((phase) => phase.key));
    expect(phaseAt(30).key).toBe('APPROACH');
  });

  it('flies a climb, level cruise, and descent', () => {
    const onDeck = sampleFlight(at(0));
    const climbing = sampleFlight(at(3));
    const cruise = sampleFlight(at(8));
    const cruiseLater = sampleFlight(at(11));
    const descending = sampleFlight(at(19));
    const landed = sampleFlight(at(23.9));

    expect(onDeck.altitude).toBeLessThan(200);
    expect(climbing.altitude).toBeGreaterThan(onDeck.altitude);
    expect(climbing.pitch).toBeGreaterThan(5);
    expect(cruise.altitude).toBeGreaterThan(24000);
    expect(Math.abs(cruise.altitude - cruiseLater.altitude)).toBeLessThan(500);
    expect(descending.pitch).toBeLessThan(0);
    expect(descending.altitude).toBeLessThan(cruise.altitude);
    expect(landed.altitude).toBeLessThan(200);
    expect(landed.airspeed).toBeLessThan(onDeck.airspeed + 50);
  });

  it('drives Nz and AOA through the warning and critical bands during the wind-up turn', () => {
    const beforeTurn = sampleFlight(at(11.5));
    const peak = sampleFlight(at(13.35));
    const recovered = sampleFlight(at(15));

    expect(beforeTurn.nz).toBeLessThan(1.5);
    expect(beforeTurn.aoa).toBeLessThan(10);
    expect(Math.abs(peak.roll)).toBeGreaterThan(45);
    expect(peak.nz).toBeGreaterThanOrEqual(6.5);
    expect(peak.aoa).toBeGreaterThanOrEqual(25);
    expect(recovered.nz).toBeLessThan(1.5);
    expect(recovered.aoa).toBeLessThan(10);

    let sawWarningOnlyNz = false;
    for (let minute = 12; minute < 14; minute += 1 / 60) {
      const state = sampleFlight(at(minute));
      if (state.nz >= 5.5 && state.nz < 6.5) {
        sawWarningOnlyNz = true;
      }
    }
    expect(sawWarningOnlyNz).toBe(true);
  });

  it('keeps engine and fuel values physically plausible', () => {
    const cruise = sampleFlight(at(8));
    const later = sampleFlight(at(20));

    expect(cruise.n1).toBeGreaterThan(50);
    expect(cruise.n1).toBeLessThanOrEqual(105);
    expect(cruise.n2).toBeGreaterThan(cruise.n1);
    expect(cruise.egt).toBeGreaterThan(400);
    expect(cruise.egt).toBeLessThan(1000);
    expect(cruise.fuelFlow).toBeGreaterThan(0);
    expect(later.fuelQuantity).toBeLessThan(cruise.fuelQuantity);
    expect(later.fuelQuantity).toBeGreaterThan(0);
  });

  it('produces a moving TSPI track', () => {
    const early = sampleFlight(at(2));
    const late = sampleFlight(at(10));

    expect(early.latitude).not.toBe(late.latitude);
    expect(early.longitude).not.toBe(late.longitude);
    expect(late.groundSpeed).toBeGreaterThan(300);
    expect(Math.abs(late.tspiAltitude - late.altitude)).toBeLessThan(1000);
  });

  it('classifies bus health from the counters', () => {
    expect(busStatusFor(1000, 0, 0)).toBe(BUS_STATUS.NOMINAL);
    expect(busStatusFor(1000, 5, 0)).toBe(BUS_STATUS.DEGRADED);
    expect(busStatusFor(1000, 0, 1)).toBe(BUS_STATUS.DEGRADED);
    expect(busStatusFor(1000, 20, 0)).toBe(BUS_STATUS.FAILED);
    expect(busStatusFor(1000, 0, 10)).toBe(BUS_STATUS.FAILED);
    expect(busStatusFor(50, 0, 0)).toBe(BUS_STATUS.FAILED);
  });

  it('degrades, fails, fails over and restores Bus B while Bus A stays nominal', () => {
    const nominal = sampleFlight(at(14));
    const degraded = sampleFlight(at(15.5));
    const failed = sampleFlight(at(16.2));
    const failedOver = sampleFlight(at(16.8));
    const restored = sampleFlight(at(18));

    expect(nominal.busBStatus).toBe(BUS_STATUS.NOMINAL);
    expect(degraded.busBStatus).toBe(BUS_STATUS.DEGRADED);
    expect(degraded.busBWordErrors).toBeGreaterThanOrEqual(5);
    expect(degraded.busBWordErrors).toBeLessThan(20);
    expect(failed.busBStatus).toBe(BUS_STATUS.FAILED);
    expect(failed.busBWordErrors).toBeGreaterThanOrEqual(20);
    expect(failedOver.busBMessageRate).toBeLessThan(10);
    expect(failedOver.busBStatus).toBe(BUS_STATUS.FAILED);
    expect(restored.busBStatus).toBe(BUS_STATUS.NOMINAL);

    [nominal, degraded, failed, failedOver, restored].forEach((state) => {
      expect(state.busAStatus).toBe(BUS_STATUS.NOMINAL);
      expect(state.busAMessageRate).toBeGreaterThan(500);
    });
  });

  it('returns test card events in chronological order within a window', () => {
    const events = eventsBetween(at(11), at(17));

    expect(events.map((event) => event.message)).toEqual([
      'TP-04 wind-up turn 4g start',
      'TP-04 Nz exceedance, knock it off',
      'TP-04 complete',
      'Bus B degraded, word errors rising',
      'Bus B failed, no-response count rising',
      'Bus B failover',
      'TP-06 descent start'
    ]);
    events.forEach((event, index) => {
      if (index > 0) {
        expect(event.utc).toBeGreaterThan(events[index - 1].utc);
      }
    });
    expect(events[0].testPoint).toBe('TP-04');
    expect(events[0].category).toBe('TEST_POINT');
    expect(events[0].phase).toBe('WIND_UP_TURN');
  });

  it('spans sortie boundaries and honors inclusive window edges', () => {
    const twoSorties = eventsBetween(SORTIE_BASE, SORTIE_BASE + 2 * SORTIE_DURATION_MS - 1);

    expect(twoSorties.length).toBe(TEST_CARD_EVENTS.length * 2);
    expect(eventsBetween(at(12), at(12)).length).toBe(1);
    expect(eventsBetween(at(12.1), at(12.2)).length).toBe(0);
    expect(eventsBetween(at(13), at(12)).length).toBe(0);
  });
});
