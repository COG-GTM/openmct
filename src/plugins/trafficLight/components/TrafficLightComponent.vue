<!--
 Open MCT, Copyright (c) 2014-2024, United States Government
 as represented by the Administrator of the National Aeronautics and Space
 Administration. All rights reserved.

 Open MCT is licensed under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0.

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 License for the specific language governing permissions and limitations
 under the License.

 Open MCT includes source code licensed under additional open source
 licenses. See the Open Source Licenses file (LICENSES.md) included with
 this source code distribution or the Licensing information page available
 at runtime from the About dialog for additional information.
-->
<template>
  <div
    class="c-traffic-light js-traffic-light"
    :class="wrapperClasses"
    role="status"
    :aria-label="ariaLabel"
    :title="statusLabel"
  >
    <div class="c-traffic-light__light js-traffic-light-light" :class="`is-${status}`"></div>
    <div v-if="displayCurVal" class="c-traffic-light__value js-traffic-light-value">
      <span class="c-traffic-light__value-text">{{ curVal }}</span>
      <span v-if="displayUnits && units" class="c-traffic-light__units">{{ units }}</span>
    </div>
  </div>
</template>

<script>
import { isIdentifier } from '@/api/objects/object-utils';
import stalenessMixin from '@/ui/mixins/staleness-mixin';

import { resolveStatus, STATUS } from '../traffic-light-status.js';

const DEFAULT_CURRENT_VALUE = '--';
const MAX_PRECISION = 20;
const STATUS_LABELS = {
  [STATUS.GREEN]: 'Nominal',
  [STATUS.YELLOW]: 'Warning',
  [STATUS.RED]: 'Critical',
  [STATUS.GRAY]: 'No data'
};

function isNumericText(value) {
  return value !== '' && value != null && !Number.isNaN(Number(value));
}

export default {
  mixins: [stalenessMixin],
  inject: ['openmct', 'domainObject', 'composition', 'renderWhenVisible'],
  data() {
    const configuration = this.domainObject.configuration ?? {};

    return {
      curVal: DEFAULT_CURRENT_VALUE,
      rawValue: undefined,
      hasData: false,
      limitEvaluation: undefined,
      limitDefinition: undefined,
      precision: configuration.precision ?? 2,
      displayCurVal: configuration.isDisplayCurVal ?? true,
      displayUnits: configuration.isDisplayUnits ?? true,
      units: '',
      valueKey: undefined,
      valueSource: undefined
    };
  },
  computed: {
    status() {
      return resolveStatus({
        hasData: this.hasData,
        isStale: this.isStale,
        limitEvaluation: this.limitEvaluation,
        limitDefinition: this.limitDefinition,
        value: this.rawValue,
        valueKey: [this.valueKey, this.valueSource]
      });
    },
    statusLabel() {
      if (this.isStale) {
        return 'Stale';
      }

      return STATUS_LABELS[this.status];
    },
    ariaLabel() {
      return `Traffic light: ${this.statusLabel}, current value ${this.curVal}`;
    },
    wrapperClasses() {
      const classes = [`c-traffic-light--${this.status}`];

      if (this.isStale) {
        classes.push('is-stale');
      }

      return classes;
    },
    timeFormatter() {
      const timeSystem = this.openmct.time.getTimeSystem();
      const metadataValue = this.metadata?.value(timeSystem.key) || { format: timeSystem.key };

      return this.openmct.telemetry.getValueFormatter(metadataValue);
    }
  },
  mounted() {
    this.composition.on('add', this.addedToComposition);
    this.composition.on('remove', this.removedFromComposition);
    this.composition.load();

    this.openmct.time.on('boundsChanged', this.refreshData);

    this.setupClockChangedEvent((domainObject) => {
      this.triggerUnsubscribeFromStaleness(domainObject);
      this.subscribeToStaleness(domainObject);
    });

    this.unobserveConfiguration = this.openmct.objects.observe(
      this.domainObject,
      'configuration',
      this.updateConfiguration
    );
  },
  unmounted() {
    this.composition.off('add', this.addedToComposition);
    this.composition.off('remove', this.removedFromComposition);
    this.openmct.time.off('boundsChanged', this.refreshData);

    this.removeTelemetryObject();

    if (this.unobserveConfiguration) {
      this.unobserveConfiguration();
    }
  },
  methods: {
    addedToComposition(domainObject) {
      if (this.telemetryObject) {
        return;
      }

      this.addTelemetryObjectAndSubscribe(domainObject);
    },
    removedFromComposition(child) {
      if (!this.telemetryObject) {
        return;
      }

      const identifier = isIdentifier(child) ? child : child?.identifier;
      const removedKey = identifier ? this.openmct.objects.makeKeyString(identifier) : undefined;
      const currentKey = this.openmct.objects.makeKeyString(this.telemetryObject.identifier);

      if (removedKey === undefined || removedKey === currentKey) {
        this.removeTelemetryObject();
      }
    },
    addTelemetryObjectAndSubscribe(domainObject) {
      this.telemetryObject = domainObject;
      this.metadata = this.openmct.telemetry.getMetadata(domainObject);

      if (!this.metadata) {
        return;
      }

      const rangeValues = this.metadata.valuesForHints(['range']);

      this.formats = this.openmct.telemetry.getFormatMap(this.metadata);
      this.valueMetadata = rangeValues.find((value) => value.format !== 'string') ?? rangeValues[0];
      this.valueKey = this.valueMetadata?.key;
      this.valueSource = this.valueMetadata?.source ?? this.valueKey;
      this.units = this.valueMetadata?.unit ?? '';
      this.limitEvaluator = this.openmct.telemetry.limitEvaluator(domainObject);

      this.openmct.telemetry
        .getLimits(domainObject)
        .limits()
        .then((limitDefinition) => {
          this.updateLimitDefinition(domainObject, limitDefinition);
        })
        .catch(() => {
          this.updateLimitDefinition(domainObject, undefined);
        });
      this.unsubscribeLimits = this.openmct.telemetry.subscribeToLimits(
        domainObject,
        (limitDefinition) => {
          this.updateLimitDefinition(domainObject, limitDefinition);
        }
      );

      this.request();
      this.subscribe();
      this.subscribeToStaleness(domainObject);
    },
    removeTelemetryObject() {
      this.requestId = (this.requestId ?? 0) + 1;

      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = undefined;
      }

      if (this.unsubscribeLimits) {
        this.unsubscribeLimits();
        this.unsubscribeLimits = undefined;
      }

      if (this.telemetryObject) {
        this.triggerUnsubscribeFromStaleness(this.telemetryObject);
      }

      this.telemetryObject = undefined;
      this.metadata = undefined;
      this.formats = undefined;
      this.valueMetadata = undefined;
      this.limitEvaluator = undefined;
      this.limitDefinition = undefined;
      this.valueKey = undefined;
      this.valueSource = undefined;
      this.units = '';
      this.clearValue();
    },
    clearValue() {
      this.datum = undefined;
      this.curVal = DEFAULT_CURRENT_VALUE;
      this.rawValue = undefined;
      this.limitEvaluation = undefined;
      this.hasData = false;
    },
    refreshData(bounds, isTick) {
      if (isTick || !this.telemetryObject) {
        return;
      }

      this.clearValue();
      this.request();
    },
    request() {
      const requestedObject = this.telemetryObject;
      const requestId = (this.requestId ?? 0) + 1;
      const options = {
        strategy: 'latest',
        size: 1,
        timeContext: this.openmct.time.getContextForView([])
      };

      this.requestId = requestId;
      this.openmct.telemetry.request(requestedObject, options).then((values) => {
        const isCurrent = requestId === this.requestId && requestedObject === this.telemetryObject;

        if (isCurrent && values && values.length) {
          this.updateValue(values[values.length - 1]);
        }
      });
    },
    subscribe() {
      this.unsubscribe = this.openmct.telemetry.subscribe(this.telemetryObject, this.updateValue);
    },
    updateLimitDefinition(domainObject, limitDefinition) {
      if (domainObject === this.telemetryObject) {
        this.limitDefinition = limitDefinition;
      }
    },
    updateConfiguration(configuration) {
      if (!configuration) {
        return;
      }

      this.precision = configuration.precision ?? 2;
      this.displayCurVal = configuration.isDisplayCurVal ?? true;
      this.displayUnits = configuration.isDisplayUnits ?? true;

      if (this.datum) {
        this.render(this.datum);
      }
    },
    updateValue(datum) {
      if (!datum || !this.formats) {
        return;
      }

      const { start, end } = this.openmct.time.getBounds();
      const timestamp = this.timeFormatter.parse(datum);
      if (timestamp < start || timestamp > end) {
        return;
      }

      this.datum = datum;

      if (this.isRendering) {
        return;
      }

      this.isRendering = true;
      this.renderWhenVisible(() => {
        this.isRendering = false;

        if (this.datum) {
          this.render(this.datum);
        }
      });
    },
    render(datum) {
      const formatter = this.formats?.[this.valueKey] ?? this.formats?.[this.valueSource];
      const raw = formatter ? formatter.parse(datum) : datum[this.valueSource];
      const formatted = formatter ? formatter.format(datum) : raw;
      const numeric = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

      this.rawValue = numeric;
      this.curVal =
        numeric !== undefined && isNumericText(formatted)
          ? this.formatNumber(numeric)
          : String(formatted ?? DEFAULT_CURRENT_VALUE);
      this.limitEvaluation = this.limitEvaluator?.evaluate(datum, this.valueMetadata);
      this.hasData = true;
    },
    formatNumber(value) {
      const precision = Number(this.precision);

      if (!Number.isInteger(precision) || precision < 0 || precision > MAX_PRECISION) {
        return value.toString();
      }

      return value.toFixed(precision);
    }
  }
};
</script>
