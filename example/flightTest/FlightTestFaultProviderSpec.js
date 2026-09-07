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

import { sampleFlight, SORTIE_DURATION_MS } from './flightProfile.js';
import FlightTestFaultProvider, {
  ALARMS,
  FAULT_NAMESPACE,
  GLOBAL_ALARM_STATUS,
  SHELVE_DURATIONS
} from './FlightTestFaultProvider.js';

const MINUTE_MS = 60_000;
const SORTIE_BASE = 3_000 * SORTIE_DURATION_MS;
const FAULT_MANAGEMENT = { type: 'faultManagement', identifier: { namespace: '', key: 'fm' } };

function at(minutes) {
  return SORTIE_BASE + Math.round(minutes * MINUTE_MS);
}

function faultIds(faults) {
  return faults.map((fault) => fault.id).sort();
}

describe('The flight test fault provider', () => {
  let provider;

  beforeEach(() => {
    provider = new FlightTestFaultProvider({ pollPeriod: 1000, now: () => at(13.35) });
  });

  afterEach(() => {
    provider.stop();
  });

  it('serves only Fault Management objects', () => {
    expect(provider.supportsRequest(FAULT_MANAGEMENT)).toBe(true);
    expect(provider.supportsSubscribe(FAULT_MANAGEMENT)).toBe(true);
    expect(provider.supportsRequest({ type: 'folder' })).toBe(false);
    expect(provider.supportsSubscribe(undefined)).toBe(false);
  });

  it('has no faults while the aircraft is within limits', async () => {
    provider.evaluate(at(8));

    expect(await provider.request(FAULT_MANAGEMENT)).toEqual([]);
  });

  it('raises CRITICAL faults when Nz and AOA exceed their critical limits', async () => {
    const state = sampleFlight(at(13.35));
    provider.evaluate(at(13.35));
    const faults = (await provider.request(FAULT_MANAGEMENT)).map((entry) => entry.fault);

    expect(faultIds(faults)).toEqual(['ta-01.pcm.aoa', 'ta-01.pcm.nz']);

    const nz = faults.find((fault) => fault.id === 'ta-01.pcm.nz');
    expect(nz.name).toBe('Normal Load Factor (Nz)');
    expect(nz.namespace).toBe(FAULT_NAMESPACE);
    expect(nz.severity).toBe('CRITICAL');
    expect(nz.acknowledged).toBe(false);
    expect(nz.shelved).toBe(false);
    expect(nz.triggerTime).toBe(new Date(at(13.35)).toISOString());
    expect(nz.triggerValueInfo).toEqual({
      value: `${state.nz} g`,
      rangeCondition: 'HIGH',
      monitoringResult: 'CRITICAL'
    });
    expect(nz.currentValueInfo).toEqual(nz.triggerValueInfo);
    expect(nz.shortDescription).toContain('6.5 g');
  });

  it('does not raise a fault for a warning-only exceedance', () => {
    let warningOnly;

    for (let minute = 12; minute < 14 && warningOnly === undefined; minute += 1 / 60) {
      const state = sampleFlight(at(minute));
      if (state.nz >= 5.5 && state.nz < 6.5 && state.aoa < 25) {
        warningOnly = at(minute);
      }
    }

    expect(warningOnly).toBeDefined();
    expect(provider.evaluate(warningOnly)).toEqual([]);
  });

  it('raises a WARNING fault when Bus B degrades and escalates to CRITICAL when it fails', () => {
    const degraded = provider.evaluate(at(15.5));

    expect(faultIds(degraded)).toEqual(['ta-01.bus.b.status']);
    const status = degraded.find((fault) => fault.id === 'ta-01.bus.b.status');
    expect(status.severity).toBe('WARNING');
    expect(status.name).toBe('Bus B Status');
    expect(status.currentValueInfo.value).toBe('DEGRADED');
    expect(status.shortDescription).toBe('MIL-STD-1553 Bus B DEGRADED');

    const failed = provider.evaluate(at(16.2));
    const escalated = failed.find((fault) => fault.id === 'ta-01.bus.b.status');
    expect(escalated.severity).toBe('CRITICAL');
    expect(escalated.currentValueInfo.value).toBe('FAILED');
    expect(escalated.triggerTime).toBe(new Date(at(16.2)).toISOString());
    expect(escalated.triggerValueInfo.monitoringResult).toBe('CRITICAL');
    expect(escalated.acknowledged).toBe(false);

    const wordErrors = failed.find((fault) => fault.id === 'ta-01.bus.b.word-errors');
    expect(wordErrors.severity).toBe('CRITICAL');
    expect(wordErrors.currentValueInfo.value).toMatch(/^\d+ err\/s$/);
  });

  it('does not fault word errors while they are only in the warning band', () => {
    const state = sampleFlight(at(15.5));
    const degraded = provider.evaluate(at(15.5));

    expect(state.busBWordErrors).toBeGreaterThanOrEqual(5);
    expect(state.busBWordErrors).toBeLessThan(20);
    expect(degraded.find((fault) => fault.id === 'ta-01.bus.b.word-errors')).toBeUndefined();
  });

  it('never faults Bus A during the sortie', () => {
    for (let minute = 0; minute < 24; minute += 0.25) {
      const ids = faultIds(provider.evaluate(at(minute)));
      expect(ids.some((id) => id.startsWith('ta-01.bus.a'))).toBe(false);
    }
  });

  it('latches faults until the condition clears and the operator acknowledges', async () => {
    provider.evaluate(at(13.35));
    const cleared = provider.evaluate(at(14.5));
    const nz = cleared.find((fault) => fault.id === 'ta-01.pcm.nz');

    expect(nz).toBeDefined();
    expect(nz.severity).toBe('CRITICAL');
    expect(nz.currentValueInfo.monitoringResult).toBe('IN_LIMITS');
    expect(nz.currentValueInfo.rangeCondition).toBe('IN_LIMITS');

    const result = await provider.acknowledgeFault(nz, { comment: 'Pilot called knock-it-off' });
    expect(result).toEqual({ success: true });
    expect(faultIds(provider.snapshot())).toEqual(['ta-01.pcm.aoa']);
  });

  it('keeps an acknowledged fault listed while the condition persists, then drops it', async () => {
    provider.evaluate(at(13.35));
    const [first] = provider.snapshot();

    await provider.acknowledgeFault(first, {});
    const stillActive = provider.evaluate(at(13.36)).find((fault) => fault.id === first.id);
    expect(stillActive.acknowledged).toBe(true);
    expect(stillActive.acknowledgeComment).toBe('');

    const afterClear = provider.evaluate(at(15));
    expect(afterClear.find((fault) => fault.id === first.id)).toBeUndefined();
  });

  it('re-triggers an acknowledged fault that clears and recurs', async () => {
    provider.evaluate(at(13.35));
    const nz = provider.snapshot().find((fault) => fault.id === 'ta-01.pcm.nz');
    await provider.acknowledgeFault(nz, {});

    provider.evaluate(at(15));
    const nextSortie = provider.evaluate(at(13.35) + SORTIE_DURATION_MS);
    const recurred = nextSortie.find((fault) => fault.id === 'ta-01.pcm.nz');

    expect(recurred.acknowledged).toBe(false);
    expect(recurred.triggerTime).toBe(new Date(at(13.35) + SORTIE_DURATION_MS).toISOString());
  });

  it('shelves and unshelves faults, expiring timed shelves', async () => {
    jasmine.clock().install();

    try {
      provider.evaluate(at(13.35));
      const nz = provider.snapshot().find((fault) => fault.id === 'ta-01.pcm.nz');

      expect(
        await provider.shelveFault(nz, { shelved: true, comment: 'Known', shelveDuration: 5000 })
      ).toEqual({ success: true });
      expect(provider.snapshot().find((fault) => fault.id === nz.id).shelved).toBe(true);
      expect(provider.snapshot().find((fault) => fault.id === nz.id).shelveComment).toBe('Known');

      jasmine.clock().tick(5001);
      expect(provider.snapshot().find((fault) => fault.id === nz.id).shelved).toBe(false);

      await provider.shelveFault(nz, { shelved: true, shelveDuration: 0 });
      jasmine.clock().tick(60 * MINUTE_MS);
      expect(provider.snapshot().find((fault) => fault.id === nz.id).shelved).toBe(true);

      await provider.shelveFault(nz, { shelved: false });
      expect(provider.snapshot().find((fault) => fault.id === nz.id).shelved).toBe(false);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('cancels a pending shelve timer when the fault is removed', async () => {
    jasmine.clock().install();

    try {
      const listener = jasmine.createSpy('listener');
      provider.subscribe({}, listener);

      provider.evaluate(at(13.35));
      const nz = provider.snapshot().find((fault) => fault.id === 'ta-01.pcm.nz');
      await provider.shelveFault(nz, { shelved: true, shelveDuration: 5000 });
      await provider.acknowledgeFault(nz, {});
      provider.evaluate(at(14.5));
      expect(faultIds(provider.snapshot())).toEqual(['ta-01.pcm.aoa']);

      listener.calls.reset();
      jasmine.clock().tick(5001);
      expect(listener).not.toHaveBeenCalled();

      const aoa = provider.snapshot().find((fault) => fault.id === 'ta-01.pcm.aoa');
      await provider.shelveFault(aoa, { shelved: true, shelveDuration: 5000 });
      provider.evaluate(at(14.5));
      await provider.acknowledgeFault(aoa, {});
      expect(provider.snapshot()).toEqual([]);

      listener.calls.reset();
      jasmine.clock().tick(5001);
      expect(listener).not.toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('reports failure when acknowledging or shelving an unknown fault', async () => {
    expect(await provider.acknowledgeFault({ id: 'nope' }, {})).toEqual({ success: false });
    expect(await provider.shelveFault({ id: 'nope' }, {})).toEqual({ success: false });
    expect(await provider.acknowledgeFault(undefined, {})).toEqual({ success: false });
  });

  it('offers shelve durations', () => {
    expect(provider.getShelveDurations()).toBe(SHELVE_DURATIONS);
    expect(SHELVE_DURATIONS.map((duration) => duration.value)).toContain(0);
  });

  it('notifies subscribers of list changes and per-fault updates', async () => {
    const callback = jasmine.createSpy('callback');
    const unsubscribe = provider.subscribe(FAULT_MANAGEMENT, callback);

    expect(callback).toHaveBeenCalledWith({ type: GLOBAL_ALARM_STATUS });
    callback.calls.reset();

    provider.evaluate(at(13.35));
    expect(callback).toHaveBeenCalledWith({ type: GLOBAL_ALARM_STATUS });
    callback.calls.reset();

    provider.evaluate(at(13.36));
    const updates = callback.calls.allArgs().map(([message]) => message);
    expect(updates.every((message) => message.type === ALARMS)).toBe(true);
    expect(updates.length).toBe(2);
    const nzUpdate = updates.find((message) => message.fault.id === 'ta-01.pcm.nz');
    expect(nzUpdate.fault.currentValueInfo.value).toBe(`${sampleFlight(at(13.36)).nz} g`);
    expect(nzUpdate.fault.triggerValueInfo.value).toBe(`${sampleFlight(at(13.35)).nz} g`);
    callback.calls.reset();

    const nz = provider.snapshot().find((fault) => fault.id === 'ta-01.pcm.nz');
    await provider.acknowledgeFault(nz, {});
    expect(callback).toHaveBeenCalledWith({
      type: ALARMS,
      fault: jasmine.objectContaining({ id: 'ta-01.pcm.nz', acknowledged: true })
    });
    callback.calls.reset();

    unsubscribe();
    provider.evaluate(at(15));
    expect(callback).not.toHaveBeenCalled();
  });

  it('returns copies so the view cannot mutate provider state', async () => {
    provider.evaluate(at(13.35));
    const [entry] = await provider.request(FAULT_MANAGEMENT);
    entry.fault.acknowledged = true;

    const [again] = await provider.request(FAULT_MANAGEMENT);
    expect(again.fault.acknowledged).toBe(false);
  });

  it('polls the clock while started and stops cleanly', () => {
    jasmine.clock().install();

    try {
      let minutes = 8;
      const polled = new FlightTestFaultProvider({ pollPeriod: 1000, now: () => at(minutes) });
      const callback = jasmine.createSpy('callback');
      polled.subscribe(FAULT_MANAGEMENT, callback);
      callback.calls.reset();

      polled.start();
      polled.start();
      expect(polled.snapshot()).toEqual([]);

      minutes = 13.35;
      jasmine.clock().tick(1000);
      expect(faultIds(polled.snapshot())).toEqual(['ta-01.pcm.aoa', 'ta-01.pcm.nz']);
      expect(callback).toHaveBeenCalledWith({ type: GLOBAL_ALARM_STATUS });

      polled.stop();
      minutes = 16.2;
      jasmine.clock().tick(5000);
      expect(faultIds(polled.snapshot())).toEqual(['ta-01.pcm.aoa', 'ta-01.pcm.nz']);
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
