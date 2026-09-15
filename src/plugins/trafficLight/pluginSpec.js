/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/
import { createOpenMct, renderWhenVisible, resetApplicationState } from 'utils/testing';
import { nextTick } from 'vue';

import {
  resolveStatus,
  STATUS,
  statusFromLimitDefinition,
  statusFromLimitEvaluation
} from './traffic-light-status.js';

const TRAFFIC_LIGHT_IDENTIFIER = {
  key: 'traffic-light',
  namespace: 'test-namespace'
};

const SINE_WAVE_IDENTIFIER = {
  key: 'sine-wave',
  namespace: 'test-namespace'
};

const trafficLightDomainObject = {
  identifier: TRAFFIC_LIGHT_IDENTIFIER,
  type: 'trafficLight',
  name: 'Traffic Light',
  configuration: {
    precision: 2,
    isDisplayCurVal: true,
    isDisplayUnits: true
  },
  composition: [SINE_WAVE_IDENTIFIER]
};

const sineWaveDomainObject = {
  identifier: SINE_WAVE_IDENTIFIER,
  type: 'generator',
  name: 'Sine Wave Generator',
  telemetry: {
    period: 10,
    amplitude: 1,
    offset: 0,
    dataRateInHz: 1,
    phase: 0,
    randomness: 0,
    loadDelay: 0,
    infinityValues: false,
    exceedFloat32: false,
    staleness: false
  }
};

const TIME_BOUNDS = {
  start: 1000,
  end: 5000
};

function sineDatum(sin) {
  return {
    utc: 2000,
    yesterday: 2000,
    sin,
    cos: 0,
    wavelengths: [],
    intensities: []
  };
}

describe('Traffic Light plugin', () => {
  let openmct;
  let child;
  let holder;

  beforeEach((done) => {
    holder = document.createElement('div');
    holder.style.display = 'block';
    holder.style.width = '1920px';
    holder.style.height = '1080px';

    child = document.createElement('div');
    holder.appendChild(child);

    openmct = createOpenMct();
    openmct.on('start', done);

    openmct.install(openmct.plugins.example.Generator());

    openmct.startHeadless();
  });

  afterEach(() => {
    return resetApplicationState(openmct);
  });

  it('registers the trafficLight type', () => {
    const trafficLightType = openmct.types.get('trafficLight');

    expect(trafficLightType).not.toBeNull();
    expect(trafficLightType.definition.name).toEqual('Traffic Light');
  });

  it('trafficLight type is creatable', () => {
    const trafficLightType = openmct.types.get('trafficLight');

    expect(trafficLightType.definition.creatable).toBeTrue();
  });

  it('initializes new objects with an empty composition and default precision', () => {
    const trafficLightType = openmct.types.get('trafficLight');
    const domainObject = {};

    trafficLightType.definition.initialize(domainObject);

    expect(domainObject.composition).toEqual([]);
    expect(domainObject.configuration.precision).toEqual(2);
  });

  it('provides a view for trafficLight objects', () => {
    const applicableViews = openmct.objectViews.get(trafficLightDomainObject, [
      trafficLightDomainObject
    ]);
    const provider = applicableViews.find((viewProvider) => viewProvider.key === 'trafficLight');

    expect(provider).toBeDefined();
    expect(provider.canView(trafficLightDomainObject)).toBeTrue();
    expect(provider.canEdit(trafficLightDomainObject)).toBeTrue();
    expect(provider.canView({ type: 'gauge' })).toBeFalse();
  });

  describe('composition policy', () => {
    it('allows a single numeric telemetry object', () => {
      const emptyTrafficLight = { ...trafficLightDomainObject, composition: [] };

      expect(openmct.composition.checkPolicy(emptyTrafficLight, sineWaveDomainObject)).toBeTrue();
    });

    it('rejects a second telemetry object', () => {
      expect(
        openmct.composition.checkPolicy(trafficLightDomainObject, {
          ...sineWaveDomainObject,
          identifier: { namespace: 'test-namespace', key: 'another-sine-wave' }
        })
      ).toBeFalse();
    });

    it('rejects non-telemetry objects', () => {
      const emptyTrafficLight = { ...trafficLightDomainObject, composition: [] };
      const folder = {
        identifier: { namespace: 'test-namespace', key: 'folder' },
        type: 'folder',
        composition: []
      };

      expect(openmct.composition.checkPolicy(emptyTrafficLight, folder)).toBeFalse();
    });
  });

  describe('status resolution', () => {
    let limitDefinition;

    beforeEach(() => {
      return openmct.telemetry
        .getLimits(sineWaveDomainObject)
        .limits()
        .then((limits) => {
          limitDefinition = limits;
        });
    });

    it('maps the Sine Wave limit definition to green, yellow and red', () => {
      expect(statusFromLimitDefinition(limitDefinition, 0.1, 'sin')).toBeUndefined();
      expect(statusFromLimitDefinition(limitDefinition, 0.6, 'sin')).toEqual(STATUS.YELLOW);
      expect(statusFromLimitDefinition(limitDefinition, -0.6, 'sin')).toEqual(STATUS.YELLOW);
      expect(statusFromLimitDefinition(limitDefinition, 0.8, 'sin')).toEqual(STATUS.RED);
      expect(statusFromLimitDefinition(limitDefinition, 0.95, 'sin')).toEqual(STATUS.RED);
      expect(statusFromLimitDefinition(limitDefinition, -3, 'sin')).toEqual(STATUS.RED);
    });

    it('maps the Sine Wave limit evaluator to yellow and red', () => {
      const evaluator = openmct.telemetry.limitEvaluator(sineWaveDomainObject);
      const valueMetadata = { key: 'sin' };

      expect(statusFromLimitEvaluation(evaluator.evaluate(sineDatum(0.1), valueMetadata))).toBe(
        undefined
      );
      expect(statusFromLimitEvaluation(evaluator.evaluate(sineDatum(0.6), valueMetadata))).toEqual(
        STATUS.YELLOW
      );
      expect(statusFromLimitEvaluation(evaluator.evaluate(sineDatum(0.95), valueMetadata))).toEqual(
        STATUS.RED
      );
    });

    it('treats evaluator results without a class or name as nominal', () => {
      expect(statusFromLimitEvaluation({})).toBeUndefined();
      expect(statusFromLimitEvaluation({ cssClass: '', name: '' })).toBeUndefined();
      expect(statusFromLimitEvaluation({ cssClass: 'is-limit--yellow' })).toEqual(STATUS.YELLOW);
    });

    it('is gray without data or when stale, and green without limits', () => {
      expect(resolveStatus({ hasData: false, isStale: false })).toEqual(STATUS.GRAY);
      expect(resolveStatus({ hasData: true, isStale: true, value: 0.95 })).toEqual(STATUS.GRAY);
      expect(resolveStatus({ hasData: true, isStale: false, value: 0.95 })).toEqual(STATUS.GREEN);
    });
  });

  describe('Traffic Light view', () => {
    let trafficLightView;
    let subscriptionCallback;
    let limitsCallback;
    let unsubscribeSpy;
    let unsubscribeLimitsSpy;
    let requestedValue;

    beforeEach(() => {
      requestedValue = 0.1;
      subscriptionCallback = undefined;
      limitsCallback = undefined;
      unsubscribeSpy = jasmine.createSpy('unsubscribe');
      unsubscribeLimitsSpy = jasmine.createSpy('unsubscribeLimits');

      const testObjectProvider = jasmine.createSpyObj('testObjectProvider', [
        'get',
        'create',
        'update',
        'observe'
      ]);

      openmct.editor = {};
      openmct.editor.isEditing = () => false;

      testObjectProvider.get.and.callFake((identifier) => {
        if (identifier.key === SINE_WAVE_IDENTIFIER.key) {
          return Promise.resolve(sineWaveDomainObject);
        }

        return Promise.resolve(trafficLightDomainObject);
      });
      testObjectProvider.create.and.returnValue(Promise.resolve(true));
      testObjectProvider.update.and.returnValue(Promise.resolve(true));
      testObjectProvider.observe.and.returnValue(() => {});
      openmct.objects.addProvider('test-namespace', testObjectProvider);

      spyOn(openmct.telemetry, 'request').and.callFake(() =>
        Promise.resolve(requestedValue === undefined ? [] : [sineDatum(requestedValue)])
      );
      spyOn(openmct.telemetry, 'subscribe').and.callFake((domainObject, callback) => {
        subscriptionCallback = callback;

        return unsubscribeSpy;
      });
      spyOn(openmct.telemetry, 'subscribeToLimits').and.callFake((domainObject, callback) => {
        limitsCallback = callback;

        return unsubscribeLimitsSpy;
      });
      spyOn(openmct.telemetry, 'subscribeToStaleness').and.returnValue(() => {});
      spyOn(openmct.telemetry, 'isStale').and.returnValue(Promise.resolve({ isStale: false }));
      spyOn(openmct.time, 'getBounds').and.returnValue(TIME_BOUNDS);

      const applicableViews = openmct.objectViews.get(trafficLightDomainObject, [
        trafficLightDomainObject
      ]);
      const provider = applicableViews.find((viewProvider) => viewProvider.key === 'trafficLight');

      return openmct.objects.getMutable(TRAFFIC_LIGHT_IDENTIFIER).then((mutableObject) => {
        trafficLightView = provider.view(mutableObject, [mutableObject]);
        trafficLightView.show(child, false, { renderWhenVisible });

        return waitForSubscription();
      });
    });

    afterEach(() => {
      trafficLightView.destroy();
    });

    function waitForSubscription() {
      return new Promise((resolve) => {
        function check() {
          if (subscriptionCallback && requestRendered()) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        }

        check();
      });
    }

    function requestRendered() {
      return holder.querySelector('.js-traffic-light-value')?.textContent.includes('0.10');
    }

    function lightElement() {
      return holder.querySelector('.js-traffic-light-light');
    }

    function emit(sin) {
      subscriptionCallback(sineDatum(sin));

      return nextTick();
    }

    function changeBounds() {
      openmct.time.emit('boundsChanged', TIME_BOUNDS, false);

      return new Promise((resolve) => setTimeout(resolve, 20)).then(nextTick);
    }

    it('renders the light and the latest formatted value', () => {
      expect(holder.querySelectorAll('.js-traffic-light').length).toBe(1);
      expect(lightElement()).not.toBeNull();
      expect(holder.querySelector('.js-traffic-light-value').textContent).toContain('0.10');
      expect(holder.querySelector('.c-traffic-light__units').textContent).toContain('Hz');
    });

    it('requests the latest value and subscribes to realtime updates', () => {
      const requestOptions = openmct.telemetry.request.calls.mostRecent().args[1];

      expect(requestOptions.strategy).toEqual('latest');
      expect(openmct.telemetry.subscribe).toHaveBeenCalled();
      expect(openmct.telemetry.subscribeToStaleness).toHaveBeenCalled();
    });

    it('is green while the value is within limits', () => {
      expect(lightElement().classList).toContain('is-green');
    });

    it('turns yellow when the value violates the warning limit', async () => {
      await emit(0.6);

      expect(lightElement().classList).toContain('is-yellow');
      expect(holder.querySelector('.js-traffic-light-value').textContent).toContain('0.60');
    });

    it('turns red when the value violates the critical limit', async () => {
      await emit(0.95);

      expect(lightElement().classList).toContain('is-red');
    });

    it('returns to green when the value comes back into limits', async () => {
      await emit(0.95);
      expect(lightElement().classList).toContain('is-red');

      await emit(-0.2);
      expect(lightElement().classList).toContain('is-green');
      expect(holder.querySelector('.js-traffic-light-value').textContent).toContain('-0.20');
    });

    it('clears the light when new bounds contain no data', async () => {
      await emit(0.95);
      expect(lightElement().classList).toContain('is-red');

      requestedValue = undefined;
      await changeBounds();

      expect(lightElement().classList).toContain('is-gray');
      expect(holder.querySelector('.js-traffic-light-value').textContent).toContain('--');
    });

    it('re-requests the latest in-bounds value when bounds change', async () => {
      requestedValue = 0.6;
      await changeBounds();

      expect(lightElement().classList).toContain('is-yellow');
      expect(holder.querySelector('.js-traffic-light-value').textContent).toContain('0.60');
    });

    it('applies limit definitions pushed by the limits subscription', async () => {
      expect(openmct.telemetry.subscribeToLimits).toHaveBeenCalled();
      expect(lightElement().classList).toContain('is-green');

      limitsCallback({ CRITICAL: { high: { sin: 0.05 } } });
      await nextTick();

      expect(lightElement().classList).toContain('is-red');
    });

    it('cleans up subscriptions on destroy', () => {
      trafficLightView.destroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(unsubscribeLimitsSpy).toHaveBeenCalled();

      trafficLightView = { destroy() {} };
    });
  });
});
