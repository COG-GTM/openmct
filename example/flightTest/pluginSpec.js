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

import { createOpenMct, resetApplicationState } from '../../src/utils/testing.js';
import { SORTIE_DURATION_MS } from './flightProfile.js';
import { NAMESPACE, ROOT_KEY, TYPES } from './parameters.js';

const MINUTE_MS = 60_000;
const SORTIE_BASE = 4_000 * SORTIE_DURATION_MS;

describe('The Flight Test example plugin', () => {
  let openmct;

  beforeEach(() => {
    openmct = createOpenMct();
  });

  afterEach(() => {
    return resetApplicationState(openmct);
  });

  it('is registered as openmct.plugins.example.FlightTest but not installed by default', () => {
    expect(openmct.plugins.example.FlightTest).toEqual(jasmine.any(Function));
    expect(openmct.types.get(TYPES.PARAMETER)).toBe(openmct.types.get('not-a-registered-type'));
    expect(openmct.faults.provider).toBeUndefined();
  });

  describe('once installed', () => {
    beforeEach(() => {
      openmct.install(openmct.plugins.example.FlightTest());
    });

    it('registers the parameter and event types', () => {
      expect(openmct.types.get(TYPES.PARAMETER).definition.name).toBe('Flight Test Parameter');
      expect(openmct.types.get(TYPES.EVENTS).definition.name).toBe('Test Card Event Stream');
    });

    it('adds the Flight Test Telemetry root and resolves the tree', async () => {
      const roots = await openmct.objects.rootRegistry.getRoots();
      const root = await openmct.objects.get({ namespace: NAMESPACE, key: ROOT_KEY });
      const testArticle = await openmct.objects.get(root.composition[0]);
      const composition = openmct.composition.get(testArticle);
      const folders = await composition.load();

      expect(roots).toContain(jasmine.objectContaining({ namespace: NAMESPACE, key: ROOT_KEY }));
      expect(root.name).toBe('Flight Test Telemetry');
      expect(testArticle.name).toBe('Test Article TA-01');
      expect(folders.map((folder) => folder.name)).toEqual([
        'PCM Parameters',
        'MIL-STD-1553 Bus Health',
        'TSPI',
        'Test Card Events'
      ]);
    });

    it('serves telemetry, limits and metadata through the telemetry API', async () => {
      const nz = await openmct.objects.get({ namespace: NAMESPACE, key: 'ta-01.pcm.nz' });
      const metadata = openmct.telemetry.getMetadata(nz);
      const start = SORTIE_BASE + 13 * MINUTE_MS;
      const data = await openmct.telemetry.request(nz, { start, end: start + 5000, size: 6 });
      const limits = await openmct.telemetry.getLimits(nz).limits();
      const evaluator = openmct.telemetry.limitEvaluator(nz);

      expect(openmct.telemetry.isTelemetryObject(nz)).toBe(true);
      expect(metadata.value('value').unit).toBe('g');
      expect(metadata.valuesForHints(['range'])[0].key).toBe('value');
      expect(metadata.valuesForHints(['domain'])[0].key).toBe('utc');
      expect(data.length).toBe(6);
      expect(data[0].utc).toBe(start);
      expect(limits.CRITICAL.high.value).toBe(6.5);
      expect(evaluator.evaluate({ value: 7 }, metadata.value('value')).cssClass).toContain(
        'is-limit--red'
      );
    });

    it('leaves parameters without limits unevaluated', async () => {
      const altitude = await openmct.objects.get({
        namespace: NAMESPACE,
        key: 'ta-01.pcm.altitude'
      });
      const metadata = openmct.telemetry.getMetadata(altitude);
      const evaluator = openmct.telemetry.limitEvaluator(altitude);
      const limits = await openmct.telemetry.getLimits(altitude).limits();

      expect(evaluator.evaluate({ value: 99999 }, metadata.value('value'))).toBeUndefined();
      expect(limits).toBeUndefined();
    });

    it('registers the fault provider with the Fault Management API', async () => {
      const faultManagement = { type: 'faultManagement', identifier: { namespace: '', key: 'fm' } };

      expect(openmct.faults.provider).toBeDefined();
      expect(openmct.faults.provider.supportsRequest(faultManagement)).toBe(true);
      expect(openmct.faults.provider.supportsSubscribe(faultManagement)).toBe(true);
      expect(openmct.faults.getShelveDurations().length).toBeGreaterThan(0);

      openmct.faults.provider.evaluate(SORTIE_BASE + 13.35 * MINUTE_MS);
      const faults = await openmct.faults.request(faultManagement);

      expect(faults.map((entry) => entry.fault.id).sort()).toEqual([
        'ta-01.pcm.aoa',
        'ta-01.pcm.nz'
      ]);
    });

    it('starts monitoring on start and stops on destroy', () => {
      const provider = openmct.faults.provider;
      spyOn(provider, 'start').and.callThrough();
      spyOn(provider, 'stop').and.callThrough();

      openmct.startHeadless();
      expect(provider.start).toHaveBeenCalled();
      expect(provider.interval).toBeDefined();

      openmct.destroy();
      expect(provider.stop).toHaveBeenCalled();
      expect(provider.interval).toBeUndefined();
    });
  });
});
