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

import ExampleUserProvider from '../../../example/exampleUser/ExampleUserProvider.js';
import { collectAuditRecords, createOpenMct, resetApplicationState } from '../../utils/testing.js';
import { MULTIPLE_PROVIDER_ERROR } from './constants.js';

describe('The User API', () => {
  let openmct;

  beforeEach(() => {
    openmct = createOpenMct();
  });

  afterEach(() => {
    const activeOverlays = openmct.overlays.activeOverlays;
    activeOverlays.forEach((overlay) => overlay.dismiss());

    return resetApplicationState(openmct);
  });

  describe('with regard to user providers', () => {
    it('allows you to specify a user provider', () => {
      openmct.user.on('providerAdded', (provider) => {
        expect(provider).toBeInstanceOf(ExampleUserProvider);
      });
      openmct.user.setProvider(new ExampleUserProvider(openmct));
    });

    it('prevents more than one user provider from being set', () => {
      openmct.user.setProvider(new ExampleUserProvider(openmct));

      expect(() => {
        openmct.user.setProvider({});
      }).toThrow(new Error(MULTIPLE_PROVIDER_ERROR));
    });

    it('provides a check for an existing user provider', () => {
      expect(openmct.user.hasProvider()).toBeFalse();

      openmct.user.setProvider(new ExampleUserProvider(openmct));

      expect(openmct.user.hasProvider()).toBeTrue();
    });
  });

  describe('with regard to role changes', () => {
    let audit;

    beforeEach(async () => {
      const provider = new ExampleUserProvider(openmct);
      provider.autoLogin('operator-one');
      openmct.user.setProvider(provider);
      // createOpenMct() seeds an active role; clear it and drain the resulting
      // record before observing so each test starts from a null role
      const seededRole = openmct.user.getActiveRole();
      const setupRecords = collectAuditRecords(openmct);
      openmct.user.setActiveRole(undefined);
      if (seededRole !== null) {
        await setupRecords.waitFor(1);
      }
      setupRecords.stop();
      audit = collectAuditRecords(openmct);
    });

    afterEach(() => {
      audit.stop();
      openmct.user.setActiveRole(undefined);
    });

    it('emits an audit record with the previous and new role', async () => {
      openmct.user.setActiveRole('flight');
      openmct.user.setActiveRole('test-conductor');
      const auditRecords = await audit.waitFor(2);

      expect(auditRecords.map((auditRecord) => auditRecord.action)).toEqual([
        'user.role.change',
        'user.role.change'
      ]);
      expect(auditRecords[0].outcome).toBe('success');
      expect(auditRecords[0].actor).toEqual({
        id: jasmine.any(String),
        username: 'operator-one',
        role: 'flight'
      });
      expect(auditRecords[0].details).toEqual({ previousRole: null, newRole: 'flight' });
      expect(auditRecords[1].details).toEqual({
        previousRole: 'flight',
        newRole: 'test-conductor'
      });
    });

    it('records clearing the active role', async () => {
      openmct.user.setActiveRole('flight');
      openmct.user.setActiveRole(undefined);
      const auditRecords = await audit.waitFor(2);

      expect(auditRecords[1].details).toEqual({ previousRole: 'flight', newRole: null });
      expect(openmct.user.getActiveRole()).toBeNull();
    });

    it('does not emit a record when the role is unchanged', async () => {
      openmct.user.setActiveRole(undefined);
      openmct.user.setActiveRole('flight');
      openmct.user.setActiveRole('flight');
      // a marker record is dispatched after anything already in flight
      await openmct.audit.record({ action: 'test.marker' });

      expect(audit.records.map((auditRecord) => auditRecord.action)).toEqual([
        'user.role.change',
        'test.marker'
      ]);
      expect(audit.records[0].details).toEqual({ previousRole: null, newRole: 'flight' });
    });
  });
});
