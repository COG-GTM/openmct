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

import FlightTestLimitProvider, { exceedanceLevel } from './FlightTestLimitProvider.js';
import FlightTestObjectProvider from './FlightTestObjectProvider.js';
import { NAMESPACE, PARAMETERS_BY_KEY, parametersWithLimits } from './parameters.js';

function identifier(key) {
  return { namespace: NAMESPACE, key };
}

describe('The flight test limit provider', () => {
  let provider;
  let objects;
  let nz;
  let aoa;
  let egt;
  let wordErrors;
  let altitude;
  let events;

  beforeEach(async () => {
    provider = new FlightTestLimitProvider();
    objects = new FlightTestObjectProvider();
    nz = await objects.get(identifier('ta-01.pcm.nz'));
    aoa = await objects.get(identifier('ta-01.pcm.aoa'));
    egt = await objects.get(identifier('ta-01.pcm.egt'));
    wordErrors = await objects.get(identifier('ta-01.bus.b.word-errors'));
    altitude = await objects.get(identifier('ta-01.pcm.altitude'));
    events = await objects.get(identifier('ta-01.events.test-card'));
  });

  it('defines the required exceedance thresholds', () => {
    expect(PARAMETERS_BY_KEY.get('ta-01.pcm.nz').limits).toEqual({
      WARNING: { high: 5.5 },
      CRITICAL: { high: 6.5 }
    });
    expect(PARAMETERS_BY_KEY.get('ta-01.pcm.aoa').limits).toEqual({
      WARNING: { high: 20 },
      CRITICAL: { high: 25 }
    });
    expect(PARAMETERS_BY_KEY.get('ta-01.pcm.egt').limits).toEqual({
      WARNING: { high: 900 },
      CRITICAL: { high: 950 }
    });
    expect(PARAMETERS_BY_KEY.get('ta-01.bus.a.word-errors').limits).toEqual({
      WARNING: { high: 5 },
      CRITICAL: { high: 20 }
    });
    expect(PARAMETERS_BY_KEY.get('ta-01.bus.b.word-errors').limits).toEqual(
      PARAMETERS_BY_KEY.get('ta-01.bus.a.word-errors').limits
    );
    expect(parametersWithLimits().map((parameter) => parameter.key)).toEqual([
      'ta-01.pcm.aoa',
      'ta-01.pcm.nz',
      'ta-01.pcm.egt',
      'ta-01.bus.a.word-errors',
      'ta-01.bus.b.word-errors'
    ]);
  });

  it('supports only parameters that define limits', () => {
    expect(provider.supportsLimits(nz)).toBe(true);
    expect(provider.supportsLimits(aoa)).toBe(true);
    expect(provider.supportsLimits(egt)).toBe(true);
    expect(provider.supportsLimits(wordErrors)).toBe(true);
    expect(provider.supportsLimits(altitude)).toBe(false);
    expect(provider.supportsLimits(events)).toBe(false);
    expect(provider.supportsLimits({ type: 'folder', identifier: identifier('ta-01') })).toBe(
      false
    );
  });

  describe('exceedance classification', () => {
    const parameter = PARAMETERS_BY_KEY.get('ta-01.pcm.nz');

    it('is inclusive at the thresholds', () => {
      expect(exceedanceLevel(parameter, 5.49)).toBeUndefined();
      expect(exceedanceLevel(parameter, 5.5)).toBe('WARNING');
      expect(exceedanceLevel(parameter, 6.49)).toBe('WARNING');
      expect(exceedanceLevel(parameter, 6.5)).toBe('CRITICAL');
      expect(exceedanceLevel(parameter, 9)).toBe('CRITICAL');
    });

    it('ignores non-numeric values and parameters without limits', () => {
      expect(exceedanceLevel(parameter, undefined)).toBeUndefined();
      expect(exceedanceLevel(parameter, Number.NaN)).toBeUndefined();
      expect(exceedanceLevel(parameter, '7')).toBeUndefined();
      expect(exceedanceLevel(PARAMETERS_BY_KEY.get('ta-01.pcm.altitude'), 1e9)).toBeUndefined();
      expect(exceedanceLevel(undefined, 1e9)).toBeUndefined();
    });
  });

  describe('the limit evaluator', () => {
    const valueMetadata = { key: 'value' };

    it('returns nothing while a value is within limits', () => {
      const evaluator = provider.getLimitEvaluator(nz);

      expect(evaluator.evaluate({ value: 1.02 }, valueMetadata)).toBeUndefined();
      expect(evaluator.evaluate({ value: 5.4999 }, valueMetadata)).toBeUndefined();
    });

    it('flags warnings yellow and criticals red', () => {
      const evaluator = provider.getLimitEvaluator(aoa);

      expect(evaluator.evaluate({ value: 21 }, valueMetadata)).toEqual({
        name: 'Warning High',
        cssClass: 'is-limit--upr is-limit--yellow',
        low: 20,
        high: 25
      });
      expect(evaluator.evaluate({ value: 26 }, valueMetadata)).toEqual({
        name: 'Critical High',
        cssClass: 'is-limit--upr is-limit--red',
        low: 25,
        high: Number.POSITIVE_INFINITY
      });
    });

    it('evaluates MIL-STD-1553 word error rates', () => {
      const evaluator = provider.getLimitEvaluator(wordErrors);

      expect(evaluator.evaluate({ value: 4 }, valueMetadata)).toBeUndefined();
      expect(evaluator.evaluate({ value: 5 }, valueMetadata).cssClass).toContain('yellow');
      expect(evaluator.evaluate({ value: 20 }, valueMetadata).cssClass).toContain('red');
    });

    it('does not evaluate non-range fields such as the timestamp or phase', () => {
      const evaluator = provider.getLimitEvaluator(egt);

      expect(evaluator.evaluate({ utc: 1e12, value: 990 }, { key: 'utc' })).toBeUndefined();
      expect(evaluator.evaluate({ phase: 'CRUISE', value: 990 }, { key: 'phase' })).toBeUndefined();
      expect(evaluator.evaluate({ value: 990 })).toBeDefined();
    });
  });

  describe('plot limit lines', () => {
    it('describes each level with the telemetry range key and a color', async () => {
      const limits = await provider.getLimits(egt).limits();

      expect(limits).toEqual({
        WARNING: { high: { color: 'yellow', value: 900 } },
        CRITICAL: { high: { color: 'red', value: 950 } }
      });
    });

    it('matches the evaluator thresholds for every limited parameter', async () => {
      for (const parameter of parametersWithLimits()) {
        const domainObject = await objects.get(identifier(parameter.key));
        const limits = await provider.getLimits(domainObject).limits();

        expect(limits.WARNING.high.value).toBe(parameter.limits.WARNING.high);
        expect(limits.CRITICAL.high.value).toBe(parameter.limits.CRITICAL.high);
        expect(limits.WARNING.low).toBeUndefined();
      }
    });
  });
});
