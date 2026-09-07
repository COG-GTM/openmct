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

import { BUS_STATUS, BUS_STATUS_ENUMERATIONS, sampleFlight } from './flightProfile.js';
import { exceedanceLevel } from './FlightTestLimitProvider.js';
import { PARAMETERS, parametersWithLimits } from './parameters.js';

export const FAULT_NAMESPACE = 'Flight Test Telemetry/Test Article TA-01';
export const FAULT_MANAGEMENT_TYPE = 'faultManagement';
export const GLOBAL_ALARM_STATUS = 'global-alarm-status';
export const ALARMS = 'alarms';
export const DEFAULT_POLL_PERIOD_MS = 1000;

export const SHELVE_DURATIONS = [
  { name: '5 Minutes', value: 300000 },
  { name: '10 Minutes', value: 600000 },
  { name: '15 Minutes', value: 900000 },
  { name: 'Indefinite', value: 0 }
];

const BUS_STATUS_SEVERITY = {
  [BUS_STATUS.DEGRADED]: 'WARNING',
  [BUS_STATUS.FAILED]: 'CRITICAL'
};

const BUS_STATUS_PARAMETERS = PARAMETERS.filter((parameter) => parameter.format === 'enum');

function busStatusString(value) {
  return BUS_STATUS_ENUMERATIONS.find((entry) => entry.value === value)?.string ?? String(value);
}

function formatValue(parameter, value) {
  if (parameter.format === 'enum') {
    return busStatusString(value);
  }

  return parameter.unit === undefined ? `${value}` : `${value} ${parameter.unit}`;
}

/**
 * Publishes exceedances as faults through the Fault Management API.
 *
 * The provider samples the simulated flight state on a fixed period and
 * raises a fault when a monitored parameter enters its CRITICAL band, or a
 * MIL-STD-1553 bus reports DEGRADED (WARNING severity) or FAILED (CRITICAL
 * severity). Faults latch: once raised they remain listed until the
 * condition clears AND an operator acknowledges them, mirroring how a
 * ground-station alarm summary behaves. Shelving suppresses a fault for a
 * chosen duration.
 */
export default class FlightTestFaultProvider {
  /**
   * @param {object} [options]
   * @param {number} [options.pollPeriod] monitor period in milliseconds
   * @param {() => number} [options.now] clock, injectable for tests
   */
  constructor(options = {}) {
    this.pollPeriod = options.pollPeriod ?? DEFAULT_POLL_PERIOD_MS;
    this.now = options.now ?? Date.now;
    this.faults = new Map();
    this.listeners = new Set();
    this.shelveTimers = new Map();
    this.sequence = 0;
    this.interval = undefined;
  }

  start() {
    if (this.interval !== undefined) {
      return;
    }

    this.evaluate(this.now());
    this.interval = setInterval(() => this.evaluate(this.now()), this.pollPeriod);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = undefined;
    this.shelveTimers.forEach((timer) => clearTimeout(timer));
    this.shelveTimers.clear();
  }

  /**
   * Evaluates the flight state at `timestamp` and updates the fault set.
   * Exposed so specs can drive the monitor deterministically.
   *
   * @returns {Array<object>} snapshot of active faults after evaluation
   */
  evaluate(timestamp) {
    const state = sampleFlight(timestamp);
    let listChanged = false;

    parametersWithLimits().forEach((parameter) => {
      const value = state[parameter.field];
      const level = exceedanceLevel(parameter, value);

      listChanged =
        this.#reconcile(parameter, {
          active: level === 'CRITICAL',
          severity: 'CRITICAL',
          value,
          timestamp,
          description: `${parameter.name} at or above critical limit ${formatValue(
            parameter,
            parameter.limits.CRITICAL.high
          )}`
        }) || listChanged;
    });

    BUS_STATUS_PARAMETERS.forEach((parameter) => {
      const value = state[parameter.field];
      const severity = BUS_STATUS_SEVERITY[value];

      listChanged =
        this.#reconcile(parameter, {
          active: severity !== undefined,
          severity,
          value,
          timestamp,
          description: `MIL-STD-1553 Bus ${parameter.bus} ${busStatusString(value)}`
        }) || listChanged;
    });

    if (listChanged) {
      this.#notify({ type: GLOBAL_ALARM_STATUS });
    }

    return this.snapshot();
  }

  snapshot() {
    return [...this.faults.values()]
      .sort((a, b) => b.triggerTimestamp - a.triggerTimestamp)
      .map((fault) => structuredClone(fault));
  }

  supportsRequest(domainObject) {
    return domainObject?.type === FAULT_MANAGEMENT_TYPE;
  }

  supportsSubscribe(domainObject) {
    return domainObject?.type === FAULT_MANAGEMENT_TYPE;
  }

  request() {
    return Promise.resolve(this.snapshot().map((fault) => ({ fault })));
  }

  subscribe(domainObject, callback) {
    this.listeners.add(callback);
    callback({ type: GLOBAL_ALARM_STATUS });

    return () => {
      this.listeners.delete(callback);
    };
  }

  acknowledgeFault(fault, ackData = {}) {
    const tracked = this.faults.get(fault?.id);

    if (tracked === undefined) {
      return Promise.resolve({ success: false });
    }

    tracked.acknowledged = true;
    tracked.acknowledgeComment = ackData.comment ?? '';

    if (tracked.currentValueInfo.monitoringResult === 'IN_LIMITS') {
      this.#remove(tracked.id);
      this.#notify({ type: GLOBAL_ALARM_STATUS });
    } else {
      this.#notify({ type: ALARMS, fault: structuredClone(tracked) });
    }

    return Promise.resolve({ success: true });
  }

  shelveFault(fault, shelveData = {}) {
    const tracked = this.faults.get(fault?.id);

    if (tracked === undefined) {
      return Promise.resolve({ success: false });
    }

    this.#clearShelveTimer(tracked.id);

    tracked.shelved = shelveData.shelved !== false;
    tracked.shelveComment = shelveData.comment ?? '';

    const duration = Number(shelveData.shelveDuration);

    if (tracked.shelved && Number.isFinite(duration) && duration > 0) {
      this.shelveTimers.set(
        tracked.id,
        setTimeout(() => {
          tracked.shelved = false;
          this.shelveTimers.delete(tracked.id);
          this.#notify({ type: ALARMS, fault: structuredClone(tracked) });
        }, duration)
      );
    }

    this.#notify({ type: ALARMS, fault: structuredClone(tracked) });

    return Promise.resolve({ success: true });
  }

  getShelveDurations() {
    return SHELVE_DURATIONS;
  }

  /**
   * @returns {boolean} true when the fault list membership changed
   */
  #reconcile(parameter, { active, severity, value, timestamp, description }) {
    const id = parameter.key;
    const existing = this.faults.get(id);
    const valueInfo = {
      value: formatValue(parameter, value),
      rangeCondition: active ? 'HIGH' : 'IN_LIMITS',
      monitoringResult: active ? severity : 'IN_LIMITS'
    };

    if (active && existing === undefined) {
      this.faults.set(id, {
        id,
        name: parameter.name,
        namespace: FAULT_NAMESPACE,
        seqNum: this.sequence++,
        severity,
        shortDescription: description,
        triggerTime: new Date(timestamp).toISOString(),
        triggerTimestamp: timestamp,
        triggerValueInfo: { ...valueInfo },
        currentValueInfo: { ...valueInfo },
        acknowledged: false,
        shelved: false
      });

      return true;
    }

    if (existing === undefined) {
      return false;
    }

    const wasInLimits = existing.currentValueInfo.monitoringResult === 'IN_LIMITS';
    const escalated = active && (wasInLimits || severity !== existing.severity);

    if (escalated) {
      existing.severity = severity;
      existing.shortDescription = description;
      existing.triggerTime = new Date(timestamp).toISOString();
      existing.triggerTimestamp = timestamp;
      existing.triggerValueInfo = { ...valueInfo };
      existing.acknowledged = false;
    }

    if (!active && !wasInLimits && existing.acknowledged) {
      this.#remove(id);

      return true;
    }

    const previous = existing.currentValueInfo;
    const changed =
      escalated ||
      previous.value !== valueInfo.value ||
      previous.monitoringResult !== valueInfo.monitoringResult;

    existing.currentValueInfo = valueInfo;

    if (changed) {
      this.#notify({ type: ALARMS, fault: structuredClone(existing) });
    }

    return escalated;
  }

  #remove(id) {
    this.#clearShelveTimer(id);
    this.faults.delete(id);
  }

  #clearShelveTimer(id) {
    clearTimeout(this.shelveTimers.get(id));
    this.shelveTimers.delete(id);
  }

  #notify(message) {
    this.listeners.forEach((listener) => listener(message));
  }
}
