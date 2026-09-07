import { createOpenMct, resetApplicationState } from 'utils/testing';

describe('Export as JSON plugin', () => {
  const ACTION_KEY = 'export.JSON';

  let openmct;
  let domainObject;
  let exportAsJSONAction;

  beforeEach((done) => {
    openmct = createOpenMct();

    openmct.on('start', done);
    openmct.startHeadless();

    exportAsJSONAction = openmct.actions.getAction(ACTION_KEY);
  });

  afterEach(() => resetApplicationState(openmct));

  it('Export as JSON action exist', () => {
    expect(exportAsJSONAction.key).toEqual(ACTION_KEY);
  });

  it('ExportAsJSONAction applies to folder', () => {
    domainObject = {
      identifier: {
        key: 'export-testing',
        namespace: ''
      },
      composition: [],
      location: 'mine',
      modified: 1640115501237,
      name: 'Unnamed Folder',
      persisted: 1640115501237,
      type: 'folder'
    };

    expect(exportAsJSONAction.appliesTo([domainObject])).toEqual(true);
  });

  it('ExportAsJSONAction applies to telemetry.plot.overlay', () => {
    domainObject = {
      identifier: {
        key: 'export-testing',
        namespace: ''
      },
      composition: [],
      location: 'mine',
      modified: 1640115501237,
      name: 'Unnamed Plot',
      persisted: 1640115501237,
      type: 'telemetry.plot.overlay'
    };

    expect(exportAsJSONAction.appliesTo([domainObject])).toEqual(true);
  });

  it('ExportAsJSONAction applies to telemetry.plot.stacked', () => {
    domainObject = {
      identifier: {
        key: 'export-testing',
        namespace: ''
      },
      composition: [],
      location: 'mine',
      modified: 1640115501237,
      name: 'Unnamed Plot',
      persisted: 1640115501237,
      type: 'telemetry.plot.stacked'
    };

    expect(exportAsJSONAction.appliesTo([domainObject])).toEqual(true);
  });

  it('ExportAsJSONAction does not apply to non-persistable objects', () => {
    domainObject = {
      identifier: {
        key: 'export-testing',
        namespace: ''
      },
      composition: [],
      location: 'mine',
      modified: 1640115501237,
      name: 'Non Editable Folder',
      persisted: 1640115501237,
      type: 'folder'
    };

    spyOn(openmct.objects, 'getProvider').and.callFake(() => {
      return { get: () => domainObject };
    });

    expect(exportAsJSONAction.appliesTo([domainObject])).toEqual(false);
  });

  it('ExportAsJSONAction exports object from tree', (done) => {
    const parent = {
      composition: [
        {
          key: 'child',
          namespace: ''
        }
      ],
      identifier: {
        key: 'parent',
        namespace: ''
      },
      name: 'Parent',
      type: 'folder',
      modified: 1503598129176,
      location: 'mine',
      persisted: 1503598129176
    };

    const child = {
      composition: [],
      identifier: {
        key: 'child',
        namespace: ''
      },
      name: 'Child',
      type: 'folder',
      modified: 1503598132428,
      location: 'parent',
      persisted: 1503598132428
    };

    spyOn(openmct.composition, 'get').and.callFake((object) => {
      return {
        load: () => {
          if (object.name === 'Parent') {
            return Promise.resolve([child]);
          }

          return Promise.resolve([]);
        }
      };
    });

    spyOn(exportAsJSONAction, 'saveAs').and.callFake((completedTree) => {
      expect(Object.keys(completedTree).length).toBe(2);
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'openmct')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'rootId')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'parent')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'child')).toBeTruthy();

      done();
    });

    exportAsJSONAction.invoke([parent]);
  });

  it('ExportAsJSONAction skips non-creatable objects from tree', (done) => {
    const parent = {
      composition: [
        {
          key: 'child',
          namespace: ''
        }
      ],
      identifier: {
        key: 'parent',
        namespace: ''
      },
      name: 'Parent of Non Editable Child Folder',
      type: 'folder',
      modified: 1503598129176,
      location: 'mine',
      persisted: 1503598129176
    };

    const child = {
      composition: [],
      identifier: {
        key: 'child',
        namespace: ''
      },
      name: 'Non Editable Child Folder',
      type: 'noneditable.folder',
      modified: 1503598132428,
      location: 'parent',
      persisted: 1503598132428
    };

    spyOn(openmct.composition, 'get').and.callFake((object) => {
      return {
        load: () => {
          if (object.identifier.key === 'parent') {
            return Promise.resolve([child]);
          }

          return Promise.resolve([]);
        }
      };
    });

    spyOn(exportAsJSONAction, 'saveAs').and.callFake((completedTree) => {
      expect(Object.keys(completedTree).length).toBe(2);
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'openmct')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'rootId')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'parent')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'child')).not.toBeTruthy();

      done();
    });

    exportAsJSONAction.invoke([parent]);
  });

  it('can export self-containing objects', (done) => {
    const parent = {
      composition: [
        {
          key: 'infiniteChild',
          namespace: ''
        }
      ],
      identifier: {
        key: 'infiniteParent',
        namespace: ''
      },
      name: 'parent',
      type: 'folder',
      modified: 1503598129176,
      location: 'mine',
      persisted: 1503598129176
    };

    const child = {
      composition: [
        {
          key: 'infiniteParent',
          namespace: ''
        }
      ],
      identifier: {
        key: 'infiniteChild',
        namespace: ''
      },
      name: 'child',
      type: 'folder',
      modified: 1503598132428,
      location: 'infiniteParent',
      persisted: 1503598132428
    };

    spyOn(openmct.composition, 'get').and.callFake((object) => {
      return {
        load: () => {
          if (object.name === 'parent') {
            return Promise.resolve([child]);
          }

          return Promise.resolve([]);
        }
      };
    });

    spyOn(exportAsJSONAction, 'saveAs').and.callFake((completedTree) => {
      expect(Object.keys(completedTree).length).toBe(2);
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'openmct')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'rootId')).toBeTruthy();
      expect(
        Object.prototype.hasOwnProperty.call(completedTree.openmct, 'infiniteParent')
      ).toBeTruthy();
      expect(
        Object.prototype.hasOwnProperty.call(completedTree.openmct, 'infiniteChild')
      ).toBeTruthy();

      done();
    });

    exportAsJSONAction.invoke([parent]);
  });

  it('exports links to external objects as new objects', function (done) {
    const parent = {
      composition: [
        {
          key: 'child',
          namespace: ''
        }
      ],
      identifier: {
        key: 'parent',
        namespace: ''
      },
      name: 'Parent',
      type: 'folder',
      modified: 1503598129176,
      location: 'mine',
      persisted: 1503598129176
    };

    const child = {
      composition: [],
      identifier: {
        key: 'child',
        namespace: ''
      },
      name: 'Child',
      type: 'folder',
      modified: 1503598132428,
      location: 'outsideOfTree',
      persisted: 1503598132428
    };

    spyOn(openmct.composition, 'get').and.callFake((object) => {
      return {
        load: () => {
          if (object.name === 'Parent') {
            return Promise.resolve([child]);
          }

          return Promise.resolve([]);
        }
      };
    });

    spyOn(exportAsJSONAction, 'saveAs').and.callFake((completedTree) => {
      expect(Object.keys(completedTree).length).toBe(2);
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'openmct')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'rootId')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'parent')).toBeTruthy();

      // parent and child objects as part of openmct but child with new id/key
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'child')).not.toBeTruthy();
      expect(Object.keys(completedTree.openmct).length).toBe(2);

      done();
    });

    exportAsJSONAction.invoke([parent]);
  });

  it('ExportAsJSONAction exports object references from tree', (done) => {
    const parent = {
      composition: [],
      configuration: {
        objectStyles: {
          conditionSetIdentifier: {
            key: 'child',
            namespace: ''
          }
        }
      },
      identifier: {
        key: 'parent',
        namespace: ''
      },
      name: 'Parent',
      type: 'folder',
      modified: 1503598129176,
      location: 'mine',
      persisted: 1503598129176
    };

    const child = {
      composition: [],
      identifier: {
        key: 'child',
        namespace: ''
      },
      name: 'Child',
      type: 'folder',
      modified: 1503598132428,
      location: null,
      persisted: 1503598132428
    };

    spyOn(openmct.objects, 'get').and.callFake((object) => {
      return Promise.resolve(child);
    });

    spyOn(exportAsJSONAction, 'saveAs').and.callFake((completedTree) => {
      expect(Object.keys(completedTree).length).toBe(2);
      const conditionSetId = Object.keys(completedTree.openmct)[1];
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'openmct')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree, 'rootId')).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(completedTree.openmct, 'parent')).toBeTruthy();
      expect(completedTree.openmct[conditionSetId].name).toBe('Child');

      done();
    });

    exportAsJSONAction.invoke([parent]);
  });

  describe('audit and error handling', () => {
    let leaf;

    function waitForAuditRecord() {
      return new Promise((resolve) => {
        const unsubscribe = openmct.audit.addProvider({
          record: (auditRecord) => {
            unsubscribe();
            resolve(auditRecord);
          }
        });
      });
    }

    beforeEach(() => {
      leaf = {
        composition: [],
        identifier: { key: 'leaf', namespace: '' },
        name: 'Leaf',
        type: 'folder',
        modified: 1503598132428,
        location: 'mine',
        persisted: 1503598132428
      };
      spyOn(openmct.composition, 'get').and.returnValue({ load: () => Promise.resolve([]) });
      spyOn(exportAsJSONAction.JSONExportService, 'export');
    });

    it('emits a success audit record when an export completes', async () => {
      const pendingRecord = waitForAuditRecord();

      exportAsJSONAction.invoke([leaf]);
      const auditRecord = await pendingRecord;

      expect(exportAsJSONAction.JSONExportService.export).toHaveBeenCalled();
      expect(auditRecord.action).toBe('export');
      expect(auditRecord.outcome).toBe('success');
      expect(auditRecord.target).toBe('leaf');
      expect(auditRecord.details).toEqual({ rootType: 'folder', objectCount: 1 });
    });

    it('shows a generic message, logs the raw error and emits a failure record when export fails', async () => {
      const rawError = new Error('CouchDB at 10.0.0.5:5984 returned 500');
      openmct.composition.get.and.returnValue({ load: () => Promise.reject(rawError) });
      spyOn(console, 'error');
      spyOn(openmct.notifications, 'error');
      const pendingRecord = waitForAuditRecord();

      exportAsJSONAction.invoke([leaf]);
      const auditRecord = await pendingRecord;

      expect(exportAsJSONAction.JSONExportService.export).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Export as JSON failed:', rawError);
      expect(openmct.notifications.error).toHaveBeenCalledOnceWith({
        title: 'Export as JSON failed',
        message: 'The selected object could not be exported.'
      });
      expect(JSON.stringify(openmct.notifications.error.calls.allArgs())).not.toContain('10.0.0.5');
      expect(auditRecord.action).toBe('export');
      expect(auditRecord.outcome).toBe('failure');
      expect(auditRecord.target).toBe('leaf');
    });

    it('propagates a descendant load failure to the generic handler and closes the dialog', async () => {
      const child = {
        composition: [],
        identifier: { key: 'child', namespace: '' },
        name: 'Child',
        type: 'folder',
        location: 'leaf',
        persisted: 1503598132428
      };
      const rawError = new Error('CouchDB at 10.0.0.5:5984 returned 500');
      openmct.composition.get.and.callFake((parent) => ({
        load: () =>
          parent.identifier.key === 'child' ? Promise.reject(rawError) : Promise.resolve([child])
      }));
      const dismiss = jasmine.createSpy('dismiss');
      spyOn(openmct.overlays, 'progressDialog').and.returnValue({
        show: () => {},
        updateProgress: () => {},
        dismiss
      });
      spyOn(console, 'error');
      spyOn(openmct.notifications, 'error');
      const pendingRecord = waitForAuditRecord();

      exportAsJSONAction.invoke([leaf]);
      const auditRecord = await pendingRecord;

      expect(exportAsJSONAction.JSONExportService.export).not.toHaveBeenCalled();
      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith('Export as JSON failed:', rawError);
      expect(openmct.notifications.error).toHaveBeenCalledTimes(1);
      expect(auditRecord.outcome).toBe('failure');
      expect(auditRecord.target).toBe('leaf');
    });
  });
});
