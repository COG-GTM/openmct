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

import { EventEmitter } from 'eventemitter3';
import { v4 as uuid } from 'uuid';

/**
 * @typedef {import('openmct').OpenMCT} OpenMCT
 * @typedef {import('openmct').Identifier} Identifier
 */

/**
 * @typedef {'success' | 'failure'} AuditOutcome
 */

/**
 * @typedef {Object} AuditActor
 * @property {string | null} id user id, or null when no user provider is configured
 * @property {string | null} username user name, or null when no user provider is configured
 * @property {string | null} role active role, or null when none is selected
 */

/**
 * @typedef {Object} AuditRecord
 * @property {string} id unique id for this record
 * @property {string} source constant component identifier ("openmct")
 * @property {string} timestamp ISO 8601 UTC timestamp from the system clock
 * @property {string} action the operator action, e.g. "import", "notebook.entry.create"
 * @property {AuditOutcome} outcome whether the action succeeded
 * @property {AuditActor} actor who performed the action
 * @property {string | null} target key string of the domain object acted upon, if any
 * @property {Object} details structured, action-specific context
 */

/**
 * @typedef {Object} AuditRecordInput
 * @property {string} action
 * @property {AuditOutcome} [outcome='success']
 * @property {Identifier | string} [target]
 * @property {Object} [details]
 */

/**
 * @typedef {Object} AuditProvider
 * @property {(record: AuditRecord) => void | Promise<void>} record receives each completed audit record
 */

const SOURCE = 'openmct';
const OUTCOMES = new Set(['success', 'failure']);

/**
 * Emits structured audit records (who / what / when / outcome) for operator
 * actions. The logger does not persist or transmit records itself; consumers
 * subscribe with {@link AuditLogger#addProvider} or listen for the `record`
 * event and forward records to a sink of their choosing.
 *
 * @extends EventEmitter
 */
export default class AuditLogger extends EventEmitter {
  /** @type {OpenMCT} */
  #openmct;
  /** @type {Set<AuditProvider>} */
  #providers = new Set();

  /**
   * @param {OpenMCT} openmct
   */
  constructor(openmct) {
    super();
    this.#openmct = openmct;
  }

  /**
   * Register a provider that receives every audit record.
   * @param {AuditProvider} provider
   * @returns {() => void} a function that removes the provider
   */
  addProvider(provider) {
    if (!provider || typeof provider.record !== 'function') {
      throw new Error('Audit providers must implement a record(auditRecord) method');
    }

    this.#providers.add(provider);

    return () => this.removeProvider(provider);
  }

  /**
   * @param {AuditProvider} provider
   */
  removeProvider(provider) {
    this.#providers.delete(provider);
  }

  /**
   * @returns {boolean} true if at least one provider is registered
   */
  hasProviders() {
    return this.#providers.size > 0;
  }

  /**
   * Build and dispatch an audit record. Never throws: failures in actor
   * resolution or in a provider are logged to the console and do not
   * interrupt the operator action being audited.
   *
   * The returned promise settles once every provider has accepted or
   * rejected the record, so callers that need confirmed delivery can await it.
   *
   * @param {AuditRecordInput} input
   * @returns {Promise<AuditRecord | undefined>} the dispatched record
   */
  async record(input) {
    if (!input || typeof input.action !== 'string' || input.action.length === 0) {
      console.error('AuditLogger.record called without an action');

      return undefined;
    }

    const outcome = OUTCOMES.has(input.outcome) ? input.outcome : 'success';
    // stamp the time of the action itself, before any asynchronous identity lookup
    const timestamp = new Date().toISOString();
    const record = {
      id: uuid(),
      source: SOURCE,
      timestamp,
      action: input.action,
      outcome,
      actor: await this.#resolveActor(),
      target: this.#normalizeTarget(input.target),
      details: input.details ? { ...input.details } : {}
    };

    await this.#dispatch(record);

    return record;
  }

  /**
   * @returns {Promise<AuditActor>}
   */
  async #resolveActor() {
    const actor = { id: null, username: null, role: null };
    const userAPI = this.#openmct.user;

    if (!userAPI?.hasProvider?.()) {
      return actor;
    }

    try {
      // capture the role synchronously so it reflects the moment of the action
      actor.role = userAPI.getActiveRole?.() ?? null;
      const user = await userAPI.getCurrentUser();
      if (user) {
        actor.id = user.getId?.() ?? null;
        actor.username = user.getName?.() ?? null;
      }
    } catch (error) {
      console.error('AuditLogger could not resolve the current user:', error);
    }

    return actor;
  }

  /**
   * @param {Identifier | string | undefined} target
   * @returns {string | null}
   */
  #normalizeTarget(target) {
    if (target === undefined || target === null) {
      return null;
    }

    if (typeof target === 'string') {
      return target;
    }

    try {
      return this.#openmct.objects.makeKeyString(target);
    } catch (error) {
      return null;
    }
  }

  /**
   * @param {AuditRecord} record
   * @returns {Promise<void>} settles when every provider has settled
   */
  #dispatch(record) {
    const deliveries = [];
    for (const provider of this.#providers) {
      try {
        const result = provider.record(record);
        if (typeof result?.then === 'function') {
          deliveries.push(
            result.then(undefined, (error) => {
              console.error('Audit provider failed to accept record:', error);
            })
          );
        }
      } catch (error) {
        console.error('Audit provider failed to accept record:', error);
      }
    }

    // emitted through the EventEmitter so on/once/off semantics are preserved
    try {
      this.emit('record', record);
    } catch (error) {
      console.error('Audit record listener failed:', error);
    }

    return Promise.all(deliveries).then(() => undefined);
  }
}
