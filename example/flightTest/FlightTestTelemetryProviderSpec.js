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
import FlightTestObjectProvider from './FlightTestObjectProvider.js';
import FlightTestTelemetryProvider, {
  MAX_REQUEST_DATUMS,
  SAMPLE_PERIOD_MS
} from './FlightTestTelemetryProvider.js';
import { EVENT_STREAM, FOLDERS, NAMESPACE, PARAMETERS, ROOT_KEY, TYPES } from './parameters.js';

const MINUTE_MS = 60_000;
const SORTIE_BASE = 2_000 * SORTIE_DURATION_MS;

function identifier(key) {
  return { namespace: NAMESPACE, key };
}

describe('The flight test object provider', () => {
  let provider;

  beforeEach(() => {
    provider = new FlightTestObjectProvider();
  });

  it('serves the root, test article and folders', async () => {
    const root = await provider.get(identifier(ROOT_KEY));
    const testArticle = await provider.get(root.composition[0]);
    const folders = await Promise.all(testArticle.composition.map((id) => provider.get(id)));

    expect(root.name).toBe('Flight Test Telemetry');
    expect(root.type).toBe('folder');
    expect(root.location).toBe('ROOT');
    expect(testArticle.name).toBe('Test Article TA-01');
    expect(testArticle.location).toBe(`${NAMESPACE}:${ROOT_KEY}`);
    expect(folders.map((folder) => folder.name)).toEqual([
      'PCM Parameters',
      'MIL-STD-1553 Bus Health',
      'TSPI',
      'Test Card Events'
    ]);
  });

  it('places every parameter in exactly one folder with telemetry metadata', async () => {
    const folders = await Promise.all(
      FOLDERS.map((folder) => provider.get(identifier(folder.key)))
    );
    const children = await Promise.all(
      folders.flatMap((folder) => folder.composition.map((id) => provider.get(id)))
    );
    const parameters = children.filter((child) => child.type === TYPES.PARAMETER);
    const events = children.filter((child) => child.type === TYPES.EVENTS);

    expect(parameters.length).toBe(PARAMETERS.length);
    expect(new Set(parameters.map((child) => child.identifier.key)).size).toBe(PARAMETERS.length);
    expect(events.length).toBe(1);
    expect(events[0].name).toBe(EVENT_STREAM.name);

    parameters.forEach((parameter) => {
      const keys = parameter.telemetry.values.map((value) => value.key);
      expect(keys).toEqual(['utc', 'value', 'phase']);
      expect(parameter.telemetry.values[0].hints.domain).toBe(1);
      expect(parameter.telemetry.values[1].hints.range).toBe(1);
    });
  });

  it('exposes the PCM parameters requested for the test article', async () => {
    const pcm = await provider.get(identifier('ta-01.pcm'));
    const names = await Promise.all(
      pcm.composition.map((id) => provider.get(id).then((o) => o.name))
    );

    expect(names).toEqual([
      'Pressure Altitude',
      'Indicated Airspeed',
      'Angle of Attack',
      'Pitch Attitude',
      'Roll Attitude',
      'Yaw / Heading',
      'Normal Load Factor (Nz)',
      'Engine N1',
      'Engine N2',
      'Exhaust Gas Temperature',
      'Fuel Flow',
      'Fuel Quantity'
    ]);
  });

  it('exposes enumerated bus status with NOMINAL / DEGRADED / FAILED', async () => {
    const status = await provider.get(identifier('ta-01.bus.b.status'));
    const value = status.telemetry.values.find((entry) => entry.key === 'value');

    expect(value.format).toBe('enum');
    expect(value.enumerations.map((entry) => entry.string)).toEqual([
      'NOMINAL',
      'DEGRADED',
      'FAILED'
    ]);
  });

  it('returns copies so callers cannot mutate the catalog', async () => {
    const first = await provider.get(identifier('ta-01.pcm.nz'));
    first.name = 'changed';
    const second = await provider.get(identifier('ta-01.pcm.nz'));

    expect(second.name).toBe('Normal Load Factor (Nz)');
  });

  it('rejects unknown identifiers', async () => {
    await expectAsync(provider.get(identifier('nope'))).toBeRejectedWithError(/Unknown/);
  });
});

describe('The flight test telemetry provider', () => {
  let provider;
  let objects;
  let nz;
  let egt;
  let busBStatus;
  let events;
  let folder;

  beforeEach(async () => {
    provider = new FlightTestTelemetryProvider();
    objects = new FlightTestObjectProvider();
    nz = await objects.get(identifier('ta-01.pcm.nz'));
    egt = await objects.get(identifier('ta-01.pcm.egt'));
    busBStatus = await objects.get(identifier('ta-01.bus.b.status'));
    events = await objects.get(identifier(EVENT_STREAM.key));
    folder = await objects.get(identifier('ta-01.pcm'));
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(SORTIE_BASE + 20 * MINUTE_MS));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('supports parameters and the event stream but not folders', () => {
    expect(provider.supportsRequest(nz)).toBe(true);
    expect(provider.supportsSubscribe(nz)).toBe(true);
    expect(provider.supportsRequest(events)).toBe(true);
    expect(provider.supportsSubscribe(events)).toBe(true);
    expect(provider.supportsRequest(folder)).toBe(false);
    expect(provider.supportsSubscribe(folder)).toBe(false);
  });

  describe('historical requests', () => {
    it('returns one datum per second in chronological order', async () => {
      const start = SORTIE_BASE + 13 * MINUTE_MS;
      const end = start + 10 * SAMPLE_PERIOD_MS;
      const data = await provider.request(nz, { start, end });

      expect(data.length).toBe(11);
      expect(data[0].utc).toBe(start);
      expect(data.at(-1).utc).toBe(end);
      data.forEach((datum, index) => {
        expect(datum.id).toBe('ta-01.pcm.nz');
        expect(datum.value).toBe(sampleFlight(datum.utc).nz);
        expect(datum.phase).toBe('WIND_UP_TURN');
        if (index > 0) {
          expect(datum.utc).toBeGreaterThan(data[index - 1].utc);
        }
      });
    });

    it('is deterministic across repeated requests', async () => {
      const options = { start: SORTIE_BASE + 5 * MINUTE_MS, end: SORTIE_BASE + 6 * MINUTE_MS };
      const first = await provider.request(egt, options);
      const second = await provider.request(egt, options);

      expect(first).toEqual(second);
      expect(first.length).toBe(61);
    });

    it('honors options.size by decimating evenly across the window', async () => {
      const start = SORTIE_BASE;
      const end = SORTIE_BASE + 10 * MINUTE_MS;
      const data = await provider.request(nz, { start, end, size: 25 });

      expect(data.length).toBe(25);
      expect(data[0].utc).toBe(start);
      expect(data.at(-1).utc).toBe(end);
      expect(data[12].utc).toBeCloseTo(start + 5 * MINUTE_MS, -3);
    });

    it('caps the total number of datums', async () => {
      const start = SORTIE_BASE - 40 * SORTIE_DURATION_MS;
      const end = SORTIE_BASE + 20 * MINUTE_MS;
      const data = await provider.request(nz, { start, end, size: MAX_REQUEST_DATUMS * 4 });
      const uncapped = await provider.request(nz, { start, end });

      expect(data.length).toBe(MAX_REQUEST_DATUMS);
      expect(uncapped.length).toBe(MAX_REQUEST_DATUMS);
    });

    it('returns only the newest sample for strategy latest', async () => {
      const start = SORTIE_BASE;
      const end = SORTIE_BASE + 13 * MINUTE_MS + 350;
      const data = await provider.request(nz, { start, end, strategy: 'latest', size: 1 });

      expect(data.length).toBe(1);
      expect(data[0].utc).toBe(SORTIE_BASE + 13 * MINUTE_MS);
    });

    it('returns the newest N samples ending at the aligned end for strategy latest', async () => {
      const end = SORTIE_BASE + 13 * MINUTE_MS + 999;
      const data = await provider.request(nz, {
        start: SORTIE_BASE,
        end,
        strategy: 'latest',
        size: 3
      });

      expect(data.map((datum) => datum.utc)).toEqual([
        SORTIE_BASE + 13 * MINUTE_MS - 2000,
        SORTIE_BASE + 13 * MINUTE_MS - 1000,
        SORTIE_BASE + 13 * MINUTE_MS
      ]);
    });

    it('never returns samples from the future', async () => {
      const now = Date.now();
      const data = await provider.request(nz, { start: now - 5000, end: now + 60_000 });

      expect(data.at(-1).utc).toBeLessThanOrEqual(now);
      expect(data.length).toBe(6);
    });

    it('returns a single sample when the window is narrower than the sample period', async () => {
      const start = SORTIE_BASE + 100;
      const data = await provider.request(nz, { start, end: start + 200 });

      expect(data.length).toBe(1);
      expect(data[0].utc).toBe(SORTIE_BASE);
    });

    it('returns enumerated bus status values as numbers', async () => {
      const start = SORTIE_BASE + 16.2 * MINUTE_MS;
      const data = await provider.request(busBStatus, { start, end: start + 2000 });

      data.forEach((datum) => expect(datum.value).toBe(2));
    });

    it('returns test card events within the window as label/message datums', async () => {
      const data = await provider.request(events, {
        start: SORTIE_BASE + 11 * MINUTE_MS,
        end: SORTIE_BASE + 14.5 * MINUTE_MS
      });

      expect(data.map((datum) => datum.message)).toEqual([
        'TP-04 wind-up turn 4g start',
        'TP-04 Nz exceedance, knock it off',
        'TP-04 complete'
      ]);
      expect(data[0].id).toBe(EVENT_STREAM.key);
      expect(data[0].utc).toBe(SORTIE_BASE + 12 * MINUTE_MS);
      expect(data[0].testPoint).toBe('TP-04');
    });

    it('honors size and latest for the event stream', async () => {
      const options = { start: SORTIE_BASE, end: SORTIE_BASE + 17 * MINUTE_MS };
      const sized = await provider.request(events, { ...options, size: 2 });
      const latest = await provider.request(events, { ...options, strategy: 'latest' });

      expect(sized.map((datum) => datum.message)).toEqual([
        'Bus B failover',
        'TP-06 descent start'
      ]);
      expect(latest.length).toBe(1);
      expect(latest[0].message).toBe('TP-06 descent start');
    });
  });

  describe('realtime subscriptions', () => {
    it('streams one parameter datum per second from the same profile', () => {
      const callback = jasmine.createSpy('callback');
      const unsubscribe = provider.subscribe(nz, callback);

      jasmine.clock().tick(SAMPLE_PERIOD_MS * 3);

      expect(callback).toHaveBeenCalledTimes(3);
      const datum = callback.calls.mostRecent().args[0];
      expect(datum.id).toBe('ta-01.pcm.nz');
      expect(datum.utc).toBe(Date.now());
      expect(datum.value).toBe(sampleFlight(Date.now()).nz);

      unsubscribe();
      jasmine.clock().tick(SAMPLE_PERIOD_MS * 3);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('streams test card events as they occur and stops after unsubscribe', () => {
      jasmine.clock().mockDate(new Date(SORTIE_BASE + 12 * MINUTE_MS - 1500));
      const callback = jasmine.createSpy('callback');
      const unsubscribe = provider.subscribe(events, callback);

      jasmine.clock().tick(1000);
      expect(callback).not.toHaveBeenCalled();

      jasmine.clock().tick(1000);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.calls.mostRecent().args[0].message).toBe('TP-04 wind-up turn 4g start');
      expect(callback.calls.mostRecent().args[0].id).toBe(EVENT_STREAM.key);

      unsubscribe();
      jasmine.clock().tick(3 * MINUTE_MS);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
