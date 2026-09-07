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

import { createOpenMct, resetApplicationState } from 'utils/testing';

import AuditLogger from './AuditLogger.js';

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('The AuditLogger', () => {
  let openmct;

  beforeEach(() => {
    openmct = createOpenMct();
  });

  afterEach(() => {
    return resetApplicationState(openmct);
  });

  it('is registered on the openmct instance', () => {
    expect(openmct.audit).toBeInstanceOf(AuditLogger);
  });

  it('emits a structured record with who, what, when and outcome', async () => {
    const received = [];
    openmct.audit.on('record', (auditRecord) => received.push(auditRecord));

    const auditRecord = await openmct.audit.record({
      action: 'export',
      outcome: 'success',
      target: { namespace: 'ns', key: 'abc' },
      details: { objectCount: 3 }
    });

    expect(received).toEqual([auditRecord]);
    expect(auditRecord.id).toEqual(jasmine.any(String));
    expect(auditRecord.source).toBe('openmct');
    expect(auditRecord.timestamp).toMatch(ISO_8601);
    expect(auditRecord.action).toBe('export');
    expect(auditRecord.outcome).toBe('success');
    expect(auditRecord.actor).toEqual({ id: null, username: null, role: null });
    expect(auditRecord.target).toBe('ns:abc');
    expect(auditRecord.details).toEqual({ objectCount: 3 });
  });

  it('assigns a unique id to every record', async () => {
    const [first, second] = await Promise.all([
      openmct.audit.record({ action: 'a' }),
      openmct.audit.record({ action: 'b' })
    ]);

    expect(first.id).not.toEqual(second.id);
  });

  it('defaults the outcome to success and rejects unknown outcomes', async () => {
    const defaulted = await openmct.audit.record({ action: 'a' });
    const unknown = await openmct.audit.record({ action: 'a', outcome: 'maybe' });
    const failure = await openmct.audit.record({ action: 'a', outcome: 'failure' });

    expect(defaulted.outcome).toBe('success');
    expect(unknown.outcome).toBe('success');
    expect(failure.outcome).toBe('failure');
  });

  it('accepts key-string targets and tolerates a missing target', async () => {
    const keyString = await openmct.audit.record({ action: 'a', target: 'ns:abc' });
    const missing = await openmct.audit.record({ action: 'a' });

    expect(keyString.target).toBe('ns:abc');
    expect(missing.target).toBeNull();
  });

  it('refuses to emit a record without an action', async () => {
    spyOn(console, 'error');
    const listener = jasmine.createSpy('listener');
    openmct.audit.on('record', listener);

    expect(await openmct.audit.record()).toBeUndefined();
    expect(await openmct.audit.record({})).toBeUndefined();
    expect(await openmct.audit.record({ action: '' })).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('copies details so later mutation does not alter the record', async () => {
    const details = { count: 1 };
    const auditRecord = await openmct.audit.record({ action: 'a', details });
    details.count = 2;

    expect(auditRecord.details.count).toBe(1);
  });

  describe('providers', () => {
    it('delivers records to registered providers until they are removed', async () => {
      const provider = { record: jasmine.createSpy('record') };
      const removeProvider = openmct.audit.addProvider(provider);

      expect(openmct.audit.hasProviders()).toBeTrue();

      const first = await openmct.audit.record({ action: 'first' });
      expect(provider.record).toHaveBeenCalledOnceWith(first);

      removeProvider();
      await openmct.audit.record({ action: 'second' });

      expect(provider.record).toHaveBeenCalledTimes(1);
      expect(openmct.audit.hasProviders()).toBeFalse();
    });

    it('rejects providers that do not implement record()', () => {
      expect(() => openmct.audit.addProvider({})).toThrowError(
        'Audit providers must implement a record(auditRecord) method'
      );
      expect(() => openmct.audit.addProvider(undefined)).toThrowError();
    });

    it('isolates a failing provider so other providers still receive the record', async () => {
      spyOn(console, 'error');
      const failing = {
        record: () => {
          throw new Error('sink unavailable');
        }
      };
      const healthy = { record: jasmine.createSpy('record') };
      openmct.audit.addProvider(failing);
      openmct.audit.addProvider(healthy);

      const auditRecord = await openmct.audit.record({ action: 'a' });

      expect(healthy.record).toHaveBeenCalledOnceWith(auditRecord);
      expect(console.error).toHaveBeenCalledWith(
        'Audit provider failed to accept record:',
        jasmine.any(Error)
      );
    });

    it('logs a rejected asynchronous provider instead of surfacing an unhandled rejection', async () => {
      spyOn(console, 'error');
      const rejection = new Error('remote sink rejected');
      const failing = { record: () => Promise.reject(rejection) };
      const healthy = { record: jasmine.createSpy('record') };
      openmct.audit.addProvider(failing);
      openmct.audit.addProvider(healthy);

      const auditRecord = await openmct.audit.record({ action: 'a' });
      await Promise.resolve();

      expect(healthy.record).toHaveBeenCalledOnceWith(auditRecord);
      expect(console.error).toHaveBeenCalledWith(
        'Audit provider failed to accept record:',
        rejection
      );
    });

    it('isolates a throwing record listener from providers and the caller', async () => {
      spyOn(console, 'error');
      const provider = { record: jasmine.createSpy('record') };
      openmct.audit.on('record', () => {
        throw new Error('listener exploded');
      });
      openmct.audit.addProvider(provider);

      const auditRecord = await openmct.audit.record({ action: 'a' });

      expect(auditRecord.action).toBe('a');
      expect(provider.record).toHaveBeenCalledOnceWith(auditRecord);
      expect(console.error).toHaveBeenCalledWith(
        'Audit record listener failed:',
        jasmine.any(Error)
      );
    });

    it('honors once(), off() and listener context for record events', async () => {
      const onceListener = jasmine.createSpy('once');
      const removedListener = jasmine.createSpy('removed');
      const context = {
        seen: [],
        contextListener(auditRecord) {
          this.seen.push(auditRecord.action);
        }
      };
      const { contextListener } = context;

      openmct.audit.once('record', onceListener);
      openmct.audit.on('record', removedListener);
      openmct.audit.on('record', contextListener, context);

      await openmct.audit.record({ action: 'first' });
      openmct.audit.off('record', removedListener);
      await openmct.audit.record({ action: 'second' });

      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(removedListener).toHaveBeenCalledTimes(1);
      expect(context.seen).toEqual(['first', 'second']);
      expect(openmct.audit.listenerCount('record')).toBe(1);

      openmct.audit.off('record', contextListener, context);
    });
  });

  describe('actor resolution', () => {
    it('captures the current user and active role when a user provider is set', async () => {
      const user = new openmct.user.User('user-1', 'Operator One');
      openmct.user.setProvider({
        getCurrentUser: () => Promise.resolve(user),
        getPossibleRoles: () => Promise.resolve(['flight'])
      });
      spyOn(openmct.user, 'getActiveRole').and.returnValue('flight');

      const auditRecord = await openmct.audit.record({ action: 'a' });

      expect(auditRecord.actor).toEqual({ id: 'user-1', username: 'Operator One', role: 'flight' });
    });

    it('still emits a record when user resolution fails', async () => {
      spyOn(console, 'error');
      openmct.user.setProvider({
        getCurrentUser: () => Promise.reject(new Error('identity service unavailable'))
      });

      const auditRecord = await openmct.audit.record({ action: 'a' });

      // the role is read synchronously from the user API, so it survives the lookup failure
      expect(auditRecord.actor).toEqual({
        id: null,
        username: null,
        role: openmct.user.getActiveRole()
      });
      expect(console.error).toHaveBeenCalledWith(
        'AuditLogger could not resolve the current user:',
        jasmine.any(Error)
      );
    });
  });
});
