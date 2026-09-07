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
import { collectAuditRecords, createOpenMct, resetApplicationState } from 'utils/testing';

import * as NotebookEntries from './notebook-entries.js';

const notebookStorage = {
  name: 'notebook',
  identifier: {
    namespace: '',
    key: 'test-notebook'
  },
  defaultSectionId: '03a79b6a-971c-4e56-9892-ec536332c3f0',
  defaultPageId: '8b548fd9-2b8a-4b02-93a9-4138e22eba00'
};

const notebookEntries = {
  '03a79b6a-971c-4e56-9892-ec536332c3f0': {
    '8b548fd9-2b8a-4b02-93a9-4138e22eba00': []
  }
};

const notebookDomainObject = {
  identifier: {
    key: 'notebook',
    namespace: ''
  },
  type: 'notebook',
  name: 'Test Notebook',
  configuration: {
    defaultSort: 'oldest',
    entries: notebookEntries,
    pageTitle: 'Page',
    sections: [],
    sectionTitle: 'Section',
    type: 'General'
  }
};

const selectedSection = {
  id: '03a79b6a-971c-4e56-9892-ec536332c3f0',
  isDefault: false,
  isSelected: true,
  name: 'Day 1',
  pages: [
    {
      id: '54deb3d5-8267-4be4-95e9-3579ed8c082d',
      isDefault: false,
      isSelected: false,
      name: 'Shift 1',
      pageTitle: 'Page'
    },
    {
      id: '2ea41c78-8e60-4657-a350-53f1a1fa3021',
      isDefault: false,
      isSelected: false,
      name: 'Shift 2',
      pageTitle: 'Page'
    },
    {
      id: '8b548fd9-2b8a-4b02-93a9-4138e22eba00',
      isDefault: false,
      isSelected: true,
      name: 'Unnamed Page',
      pageTitle: 'Page'
    }
  ],
  sectionTitle: 'Section'
};

const selectedPage = {
  id: '8b548fd9-2b8a-4b02-93a9-4138e22eba00',
  isDefault: false,
  isSelected: true,
  name: 'Unnamed Page',
  pageTitle: 'Page'
};

let openmct;

describe('Notebook Entries:', () => {
  beforeEach(() => {
    openmct = createOpenMct();
    openmct.time.setClock('local');
    openmct.types.addType('notebook', {
      creatable: true
    });
    openmct.objects.addProvider(
      '',
      jasmine.createSpyObj('mockNotebookProvider', ['create', 'update'])
    );
    openmct.editor = {
      isEditing: () => false
    };
    openmct.objects.isPersistable = () => true;
    openmct.objects.save = () => Promise.resolve(true);

    window.localStorage.setItem('notebook-storage', null);
  });

  afterEach(() => {
    notebookDomainObject.configuration.entries[selectedSection.id][selectedPage.id] = [];

    return resetApplicationState(openmct);
  });

  it('getNotebookEntries has no entries', () => {
    const entries = NotebookEntries.getNotebookEntries(
      notebookDomainObject,
      selectedSection,
      selectedPage
    );

    expect(entries.length).toEqual(0);
  });

  it('addNotebookEntry adds entry', async () => {
    const unlisten = openmct.objects.observe(notebookDomainObject, '*', (object) => {
      const entries = NotebookEntries.getNotebookEntries(
        notebookDomainObject,
        selectedSection,
        selectedPage
      );

      expect(entries.length).toEqual(1);
      unlisten();
    });

    await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
  });

  it('addNotebookEntry adds active user to entry', async () => {
    const USER = 'Timmy';
    openmct.user.hasProvider = () => true;
    openmct.user.getCurrentUser = () => {
      return Promise.resolve({
        getName: () => {
          return USER;
        }
      });
    };

    const unlisten = openmct.objects.observe(notebookDomainObject, '*', (object) => {
      const entries = NotebookEntries.getNotebookEntries(
        notebookDomainObject,
        selectedSection,
        selectedPage
      );

      expect(entries[0].createdBy).toEqual(USER);
      unlisten();
    });

    await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
  });

  it('getEntryPosById returns valid position', async () => {
    const entryId1 = await NotebookEntries.addNotebookEntry(
      openmct,
      notebookDomainObject,
      notebookStorage
    );
    const position1 = NotebookEntries.getEntryPosById(
      entryId1,
      notebookDomainObject,
      selectedSection,
      selectedPage
    );

    const entryId2 = await NotebookEntries.addNotebookEntry(
      openmct,
      notebookDomainObject,
      notebookStorage
    );
    const position2 = NotebookEntries.getEntryPosById(
      entryId2,
      notebookDomainObject,
      selectedSection,
      selectedPage
    );

    const entryId3 = await NotebookEntries.addNotebookEntry(
      openmct,
      notebookDomainObject,
      notebookStorage
    );
    const position3 = NotebookEntries.getEntryPosById(
      entryId3,
      notebookDomainObject,
      selectedSection,
      selectedPage
    );

    const success = position1 === 0 && position2 === 1 && position3 === 2;

    expect(success).toBe(true);
  });

  it('deleteNotebookEntries deletes correct page entries', async () => {
    await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
    await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
    NotebookEntries.deleteNotebookEntries(
      openmct,
      notebookDomainObject,
      selectedSection,
      selectedPage
    );
    const afterEntries = NotebookEntries.getNotebookEntries(
      notebookDomainObject,
      selectedSection,
      selectedPage
    );

    expect(afterEntries).toEqual(undefined);
  });

  describe('createNewImageEmbed', () => {
    it('settles with undefined and shows a generic message when persistence fails', async () => {
      const rawError = new Error('CouchDB at 10.0.0.5:5984 returned 500');
      openmct.objects.save = () => Promise.reject(rawError);
      spyOn(console, 'error');
      spyOn(openmct.notifications, 'error');
      const image = new Blob(['not-really-an-image'], { type: 'image/png' });

      const embed = await NotebookEntries.createNewImageEmbed(image, openmct, 'x.png');

      expect(embed).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(jasmine.stringContaining('x.png'), rawError);
      expect(openmct.notifications.error).toHaveBeenCalledOnceWith('Unable to embed image.');
    });

    it('settles with undefined when the image cannot be read', async () => {
      spyOn(console, 'error');
      spyOn(openmct.notifications, 'error');

      const embed = await NotebookEntries.createNewImageEmbed('not a blob', openmct, 'y.png');

      expect(embed).toBeUndefined();
      expect(openmct.notifications.error).toHaveBeenCalledOnceWith('Unable to embed image.');
    });
  });

  describe('audit records', () => {
    let audit;

    beforeEach(() => {
      audit = collectAuditRecords(openmct);
    });

    afterEach(() => {
      audit.stop();
    });

    it('addNotebookEntry emits a notebook.entry.create record', async () => {
      const id = await NotebookEntries.addNotebookEntry(
        openmct,
        notebookDomainObject,
        notebookStorage
      );
      const auditRecords = await audit.waitFor(1);

      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('notebook.entry.create');
      expect(auditRecords[0].outcome).toBe('success');
      expect(auditRecords[0].target).toBe('notebook');
      expect(auditRecords[0].details).toEqual({
        entryId: id,
        sectionId: selectedSection.id,
        pageId: selectedPage.id,
        embedCount: 0
      });
    });

    it('auditNotebookEntryDeletion emits a notebook.entry.delete record for one entry', async () => {
      NotebookEntries.auditNotebookEntryDeletion(
        openmct,
        notebookDomainObject,
        'entry-1',
        selectedSection,
        selectedPage
      );
      const auditRecords = await audit.waitFor(1);

      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('notebook.entry.delete');
      expect(auditRecords[0].target).toBe('notebook');
      expect(auditRecords[0].details).toEqual({
        entryId: 'entry-1',
        sectionId: selectedSection.id,
        pageId: selectedPage.id
      });
    });

    it('deleteNotebookEntries emits a notebook.entry.delete record with the removed count', async () => {
      await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
      await NotebookEntries.addNotebookEntry(openmct, notebookDomainObject, notebookStorage);
      await audit.waitFor(2);
      audit.clear();

      NotebookEntries.deleteNotebookEntries(
        openmct,
        notebookDomainObject,
        selectedSection,
        selectedPage
      );
      const auditRecords = await audit.waitFor(1);

      expect(auditRecords.length).toBe(1);
      expect(auditRecords[0].action).toBe('notebook.entry.delete');
      expect(auditRecords[0].details).toEqual({
        sectionId: selectedSection.id,
        pageId: selectedPage.id,
        entryCount: 2
      });
    });
  });
});
