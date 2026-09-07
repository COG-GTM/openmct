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

import { collectAuditRecords, createOpenMct, resetApplicationState } from 'utils/testing';

let openmct;
let importFromJSONAction;
let folderObject;
let unObserve;

describe('The import JSON action', function () {
  beforeEach((done) => {
    openmct = createOpenMct();

    openmct.on('start', done);
    openmct.startHeadless();

    importFromJSONAction = openmct.actions.getAction('import.JSON');
    folderObject = {
      composition: [],
      name: 'Unnamed Folder',
      type: 'folder',
      location: '9f6c9dae-51c3-401d-92f1-c812de942922',
      modified: 1637021471624,
      persisted: 1637021471624,
      id: '84438cda-a071-48d1-b9bf-d77bd53e59ba',
      identifier: {
        namespace: '',
        key: '84438cda-a071-48d1-b9bf-d77bd53e59ba'
      }
    };
  });

  afterEach(() => {
    importFromJSONAction = undefined;
    folderObject = undefined;
    unObserve?.();
    unObserve = undefined;

    return resetApplicationState(openmct);
  });

  it('has import as JSON action', () => {
    expect(importFromJSONAction).toBeDefined();
  });

  it('applies to return true for objects with composition', function () {
    const objectPath = [folderObject];

    spyOn(openmct.composition, 'get').and.returnValue(true);

    expect(importFromJSONAction.appliesTo(objectPath)).toBe(true);
  });

  it('applies to return false for objects without composition', function () {
    const domainObject = {
      telemetry: {
        period: 10,
        amplitude: 1,
        offset: 0,
        dataRateInHz: 1,
        phase: 0,
        randomness: 0
      },
      name: 'Unnamed Sine Wave Generator',
      type: 'generator',
      location: '84438cda-a071-48d1-b9bf-d77bd53e59ba',
      modified: 1637021471172,
      identifier: {
        namespace: '',
        key: 'c102b6e1-3c81-4618-926a-56cc310925f6'
      },
      persisted: 1637021471172
    };

    const objectPath = [domainObject];

    spyOn(openmct.types, 'get').and.returnValue({});
    spyOn(openmct.composition, 'get').and.returnValue(false);

    expect(importFromJSONAction.appliesTo(objectPath)).toBe(false);
  });

  it('calls showForm on invoke ', function () {
    const objectPath = [folderObject];

    spyOn(openmct.forms, 'showForm').and.returnValue(Promise.resolve({}));
    spyOn(importFromJSONAction, 'onSave').and.returnValue(Promise.resolve({}));
    importFromJSONAction.invoke(objectPath);

    expect(openmct.forms.showForm).toHaveBeenCalled();
  });

  it('protects against prototype pollution', (done) => {
    spyOn(openmct.forms, 'showForm').and.callFake(returnResponseWithPrototypePollution);

    unObserve = openmct.objects.observe(folderObject, '*', callback);

    importFromJSONAction.invoke([folderObject]);

    function callback(newObject) {
      const hasPollutedProto =
        Object.prototype.hasOwnProperty.call(newObject, '__proto__') ||
        Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(newObject), 'toString');

      expect(hasPollutedProto).toBeFalse();

      done();
    }

    function returnResponseWithPrototypePollution() {
      const pollutedResponse = {
        selectFile: {
          name: 'imported object',

          body: '{"openmct":{"c28d230d-e909-4a3e-9840-d9ef469dda70":{"identifier":{"key":"c28d230d-e909-4a3e-9840-d9ef469dda70","namespace":""},"name":"Unnamed Overlay Plot","type":"telemetry.plot.overlay","composition":[],"configuration":{"series":[]},"modified":1695837546833,"location":"mine","created":1695837546833,"persisted":1695837546833,"__proto__":{"toString":"foobar"}}},"rootId":"c28d230d-e909-4a3e-9840-d9ef469dda70"}'
        }
      };

      return Promise.resolve(pollutedResponse);
    }
  });
  it('preserves the integrity of the namespace and key during import', async () => {
    const incomingObject = {
      openmct: {
        '7323f02a-06ac-438d-bd58-6d6e33b8741e': {
          name: 'Some Folder',
          type: 'folder',
          composition: [
            {
              key: '9f6c2d21-5ec8-434c-9fe8-31614ae6d7e6',
              namespace: ''
            }
          ],
          modified: 1710843256162,
          location: 'mine',
          created: 1710843243471,
          persisted: 1710843256162,
          identifier: {
            namespace: '',
            key: '7323f02a-06ac-438d-bd58-6d6e33b8741e'
          }
        },
        '9f6c2d21-5ec8-434c-9fe8-31614ae6d7e6': {
          name: 'Some Clock',
          type: 'clock',
          configuration: {
            baseFormat: 'YYYY/MM/DD hh:mm:ss',
            use24: 'clock12',
            timezone: 'UTC'
          },
          modified: 1710843256152,
          location: '7323f02a-06ac-438d-bd58-6d6e33b8741e',
          created: 1710843256152,
          persisted: 1710843256152,
          identifier: {
            namespace: '',
            key: '9f6c2d21-5ec8-434c-9fe8-31614ae6d7e6'
          }
        }
      },
      rootId: '7323f02a-06ac-438d-bd58-6d6e33b8741e'
    };

    const targetDomainObject = {
      identifier: {
        namespace: 'starJones',
        key: '84438cda-a071-48d1-b9bf-d77bd53e59ba'
      },
      type: 'folder'
    };
    spyOn(openmct.objects, 'save').and.callFake((model) => Promise.resolve(model));
    spyOn(openmct.overlays, 'progressDialog').and.callFake(() => {
      return {
        updateProgress: () => {},
        dismiss: () => {}
      };
    });
    try {
      await importFromJSONAction.onSave(targetDomainObject, {
        selectFile: { body: JSON.stringify(incomingObject) }
      });

      for (const callArgs of openmct.objects.save.calls.allArgs()) {
        const savedObject = callArgs[0]; // Assuming the first argument is the object being saved.
        expect(savedObject.identifier.key.includes(':')).toBeFalse(); // Ensure no colon in the key.
        expect(savedObject.identifier.namespace).toBe(targetDomainObject.identifier.namespace);
      }
    } catch (error) {
      fail(error);
    }
  });

  describe('input validation before persistence', () => {
    let audit;

    beforeEach(() => {
      audit = collectAuditRecords(openmct);
      spyOn(console, 'error');
      spyOn(openmct.objects, 'save').and.callFake((model) => Promise.resolve(model));
      spyOn(openmct.notifications, 'error');
      spyOn(openmct.overlays, 'progressDialog').and.returnValue({
        updateProgress: () => {},
        dismiss: () => {}
      });
    });

    afterEach(() => {
      audit.stop();
    });

    function invalidTrees() {
      const key = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      function base() {
        return {
          openmct: {
            [key]: {
              identifier: { key, namespace: '' },
              name: 'Unnamed Folder',
              type: 'folder',
              composition: [],
              location: 'mine'
            }
          },
          rootId: key
        };
      }

      const reservedKey = base();
      reservedKey.openmct[key].configuration = { constructor: { prototype: {} } };

      const badIdentifier = base();
      badIdentifier.openmct[key].identifier = { key: 'someone-else', namespace: '' };

      const badType = base();
      badType.openmct[key].type = '<img src=x onerror=alert(1)>';

      const badComposition = base();
      badComposition.openmct[key].composition = [{ nope: true }];

      const badRoot = base();
      badRoot.rootId = 'missing';

      return { reservedKey, badIdentifier, badType, badComposition, badRoot };
    }

    Object.entries({
      'a reserved key': 'reservedKey',
      'a mismatched identifier': 'badIdentifier',
      'a malformed type': 'badType',
      'a malformed composition reference': 'badComposition',
      'an unknown rootId': 'badRoot'
    }).forEach(([label, treeName]) => {
      it(`rejects a payload with ${label} without persisting anything`, async () => {
        const body = JSON.stringify(invalidTrees()[treeName]);

        await importFromJSONAction.onSave(folderObject, { selectFile: { body } });

        expect(openmct.objects.save).not.toHaveBeenCalled();
        expect(openmct.notifications.error).toHaveBeenCalledOnceWith(
          'Import failed: the selected file is not a valid Open MCT export or contains unsupported content.'
        );
        expect(console.error).toHaveBeenCalled();
      });
    });

    it('emits a failure audit record when a payload is rejected', async () => {
      const body = JSON.stringify(invalidTrees().badType);

      await importFromJSONAction.onSave(folderObject, { selectFile: { body } });
      const auditRecords = await audit.waitFor(1);

      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('import');
      expect(auditRecords[0].outcome).toBe('failure');
      expect(auditRecords[0].target).toBe(folderObject.identifier.key);
      expect(auditRecords[0].details.reason).toBe('ImportValidationError');
    });

    it('emits a success audit record when a payload is imported', async () => {
      const key = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      const body = JSON.stringify({
        openmct: {
          [key]: {
            identifier: { key, namespace: '' },
            name: 'Unnamed Folder',
            type: 'folder',
            composition: [],
            location: 'mine'
          }
        },
        rootId: key
      });
      spyOn(openmct.composition, 'get').and.returnValue({ add: () => {} });

      await importFromJSONAction.onSave(folderObject, { selectFile: { body } });
      const auditRecords = await audit.waitFor(1);

      expect(openmct.objects.save).toHaveBeenCalled();
      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('import');
      expect(auditRecords[0].outcome).toBe('success');
      expect(auditRecords[0].details.objectCount).toBe(1);
      expect(auditRecords[0].details.rootType).toBe('folder');
    });

    it('emits a failure audit record and persists nothing when the composition policy rejects the root', async () => {
      const key = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      const body = JSON.stringify({
        openmct: {
          [key]: {
            identifier: { key, namespace: '' },
            name: 'Unnamed Folder',
            type: 'folder',
            composition: [],
            location: 'mine'
          }
        },
        rootId: key
      });
      spyOn(openmct.composition, 'checkPolicy').and.returnValue(false);
      const dismiss = jasmine.createSpy('dismiss');
      spyOn(openmct.overlays, 'dialog').and.returnValue({ dismiss });

      await importFromJSONAction.onSave(folderObject, { selectFile: { body } });
      const auditRecords = await audit.waitFor(1);

      expect(openmct.objects.save).not.toHaveBeenCalled();
      expect(openmct.overlays.dialog).toHaveBeenCalledTimes(1);
      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('import');
      expect(auditRecords[0].outcome).toBe('failure');
      expect(auditRecords[0].target).toBe(folderObject.identifier.key);
      expect(auditRecords[0].details).toEqual({ reason: 'CompositionPolicy', rootType: 'folder' });
    });

    it('shows a generic message and logs the raw error when saving fails', async () => {
      const key = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      const body = JSON.stringify({
        openmct: {
          [key]: {
            identifier: { key, namespace: '' },
            name: 'Unnamed Folder',
            type: 'folder',
            composition: [],
            location: 'mine'
          }
        },
        rootId: key
      });
      const rawError = new Error('ECONNREFUSED 10.0.0.5:5984 /internal/path');
      openmct.objects.save.and.returnValue(Promise.reject(rawError));

      await importFromJSONAction.onSave(folderObject, { selectFile: { body } });
      const auditRecords = await audit.waitFor(1);

      expect(openmct.notifications.error).toHaveBeenCalledOnceWith(
        'Import failed: one or more objects could not be saved.'
      );
      const shownMessages = openmct.notifications.error.calls.allArgs().flat().join(' ');
      expect(shownMessages).not.toContain('ECONNREFUSED');
      expect(console.error).toHaveBeenCalledWith(
        'Import from JSON failed while saving 1 of 1 objects:',
        [rawError]
      );
      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].outcome).toBe('failure');
      expect(auditRecords[0].details).toEqual({ objectCount: 1, failedCount: 1 });
    });

    it('waits for every save to settle and does not link the root when one save fails', async () => {
      const rootKey = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      const childKey = '0a2b9ef1-2f4d-4a3c-9b1e-2f6a2f5c1d11';
      const body = JSON.stringify({
        openmct: {
          [rootKey]: {
            identifier: { key: rootKey, namespace: '' },
            name: 'Root',
            type: 'folder',
            composition: [{ key: childKey, namespace: '' }],
            location: 'mine'
          },
          [childKey]: {
            identifier: { key: childKey, namespace: '' },
            name: 'Child',
            type: 'folder',
            composition: [],
            location: rootKey
          }
        },
        rootId: rootKey
      });
      let rootSaveSettled = false;
      openmct.objects.save.and.callFake((model) => {
        if (model.name === 'Child') {
          return Promise.reject(new Error('quota exceeded'));
        }

        return new Promise((resolve) =>
          setTimeout(() => {
            rootSaveSettled = true;
            resolve(true);
          }, 20)
        );
      });
      const compositionCollection = jasmine.createSpyObj('composition', ['add']);
      spyOn(openmct.composition, 'get').and.returnValue(compositionCollection);

      await importFromJSONAction.onSave(folderObject, { selectFile: { body } });
      const auditRecords = await audit.waitFor(1);

      expect(rootSaveSettled).toBe(true);
      expect(compositionCollection.add).not.toHaveBeenCalled();
      expect(openmct.notifications.error).toHaveBeenCalledOnceWith(
        'Import failed: one or more objects could not be saved.'
      );
      expect(auditRecords[0].outcome).toBe('failure');
      expect(auditRecords[0].details).toEqual({ objectCount: 2, failedCount: 1 });
    });

    it('rejects invalid files in the form validator with a generic message and a failure audit record', async () => {
      function validator(body) {
        return importFromJSONAction._validateJSON({ value: { body } }, folderObject);
      }

      expect(validator('not json')).toBeFalse();
      expect(validator('{"openmct":{},"rootId":"x"}')).toBeFalse();
      expect(validator('{"__proto__":{"polluted":true},"openmct":{},"rootId":"x"}')).toBeFalse();
      expect(openmct.notifications.error).toHaveBeenCalledTimes(3);
      openmct.notifications.error.calls.allArgs().forEach(([message]) => {
        expect(message).toBe(
          'Import failed: the selected file is not a valid Open MCT export or contains unsupported content.'
        );
      });

      const auditRecords = await audit.waitFor(3);
      expect(auditRecords.length).toBe(3);
      auditRecords.forEach((auditRecord) => {
        expect(auditRecord.action).toBe('import');
        expect(auditRecord.outcome).toBe('failure');
        expect(auditRecord.target).toBe(openmct.objects.makeKeyString(folderObject.identifier));
      });
      expect(auditRecords.map((auditRecord) => auditRecord.details.reason)).toEqual([
        'SyntaxError',
        'ImportValidationError',
        'ImportValidationError'
      ]);
    });

    it('accepts a well-formed export in the form validator without notifying or auditing', () => {
      const key = 'c28d230d-e909-4a3e-9840-d9ef469dda70';
      const body = JSON.stringify({
        openmct: {
          [key]: {
            identifier: { key, namespace: '' },
            name: 'Unnamed Folder',
            type: 'folder',
            composition: [],
            location: 'mine'
          }
        },
        rootId: key
      });

      expect(importFromJSONAction._validateJSON({ value: { body } }, folderObject)).toBeTrue();
      expect(openmct.notifications.error).not.toHaveBeenCalled();
      expect(audit.records.length).toBe(0);
    });
  });
});
