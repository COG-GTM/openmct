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

import {
  getImportTreeErrors,
  ImportValidationError,
  RESERVED_KEYS,
  validateImportTree
} from './importValidation.js';

const ROOT_KEY = '7323f02a-06ac-438d-bd58-6d6e33b8741e';
const CHILD_KEY = '9f6c2d21-5ec8-434c-9fe8-31614ae6d7e6';

function validTree() {
  return {
    openmct: {
      [ROOT_KEY]: {
        identifier: { namespace: '', key: ROOT_KEY },
        name: 'Some Folder',
        type: 'folder',
        composition: [{ namespace: '', key: CHILD_KEY }],
        location: 'mine',
        configuration: {
          objectStyles: {
            conditionSetIdentifier: { namespace: '', key: CHILD_KEY },
            staticStyle: { style: { color: 'red' } }
          }
        }
      },
      [CHILD_KEY]: {
        identifier: { namespace: '', key: CHILD_KEY },
        name: 'Some Clock',
        type: 'clock',
        location: ROOT_KEY,
        configuration: { timezone: 'UTC' }
      }
    },
    rootId: ROOT_KEY
  };
}

describe('Import-from-JSON validation', () => {
  it('accepts a well-formed export tree', () => {
    const tree = validTree();

    expect(getImportTreeErrors(tree)).toEqual([]);
    expect(validateImportTree(tree)).toBe(tree);
  });

  it('accepts key-string composition references', () => {
    const tree = validTree();
    tree.openmct[ROOT_KEY].composition = [CHILD_KEY, `other:${CHILD_KEY}`];

    expect(getImportTreeErrors(tree)).toEqual([]);
  });

  it('rejects payloads that are not objects', () => {
    [null, undefined, 'string', 42, [], true].forEach((payload) => {
      expect(getImportTreeErrors(payload).length).toBeGreaterThan(0);
      expect(() => validateImportTree(payload)).toThrowError(ImportValidationError);
    });
  });

  it('rejects payloads without an "openmct" map or "rootId"', () => {
    expect(getImportTreeErrors({ rootId: ROOT_KEY })).toContain(
      'Import payload is missing the "openmct" object map'
    );
    expect(getImportTreeErrors({ openmct: {} })).toContain('Import payload is missing a "rootId"');
    expect(getImportTreeErrors({ openmct: [], rootId: ROOT_KEY }).length).toBeGreaterThan(0);
    expect(getImportTreeErrors({ openmct: {}, rootId: 7 }).length).toBeGreaterThan(0);
  });

  it('rejects an empty object map and a rootId that is not in the map', () => {
    expect(getImportTreeErrors({ openmct: {}, rootId: ROOT_KEY })).toEqual(
      jasmine.arrayContaining([
        'Import payload does not contain any objects',
        'Import payload "rootId" does not refer to an object in the payload'
      ])
    );

    const tree = validTree();
    tree.rootId = 'not-present';
    expect(getImportTreeErrors(tree)).toContain(
      'Import payload "rootId" does not refer to an object in the payload'
    );
  });

  RESERVED_KEYS.forEach((reservedKey) => {
    it(`rejects a "${reservedKey}" key at the top level`, () => {
      const tree = validTree();
      // JSON.parse (without a reviver) produces own properties for these names
      const polluted = JSON.parse(
        JSON.stringify(tree).replace('"rootId"', `"${reservedKey}":{"polluted":true},"rootId"`)
      );

      const errors = getImportTreeErrors(polluted);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain(`Reserved property "${reservedKey}"`);
    });

    it(`rejects a "${reservedKey}" key nested inside object configuration`, () => {
      const tree = validTree();
      const polluted = JSON.parse(
        JSON.stringify(tree).replace(
          '"timezone":"UTC"',
          `"timezone":"UTC","${reservedKey}":{"toString":"x"}`
        )
      );

      const errors = getImportTreeErrors(polluted);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain(`Reserved property "${reservedKey}"`);
      expect(errors[0]).toContain('configuration');
    });
  });

  it('does not treat inherited prototype properties as reserved keys', () => {
    // a plain object only has inherited "constructor"; that must not be reported
    expect(getImportTreeErrors(validTree())).toEqual([]);
  });

  it('rejects objects with a missing or malformed identifier', () => {
    const missing = validTree();
    delete missing.openmct[CHILD_KEY].identifier;
    expect(getImportTreeErrors(missing)).toContain(
      `object "${CHILD_KEY}" has a missing or malformed identifier`
    );

    const malformed = validTree();
    malformed.openmct[CHILD_KEY].identifier = { namespace: 5, key: {} };
    expect(getImportTreeErrors(malformed)).toContain(
      `object "${CHILD_KEY}" has a missing or malformed identifier`
    );

    const asString = validTree();
    asString.openmct[CHILD_KEY].identifier = CHILD_KEY;
    expect(getImportTreeErrors(asString)).toContain(
      `object "${CHILD_KEY}" has a missing or malformed identifier`
    );
  });

  it('rejects objects whose identifier does not match their key', () => {
    const tree = validTree();
    tree.openmct[CHILD_KEY].identifier = { namespace: '', key: 'somebody-else' };

    expect(getImportTreeErrors(tree)).toContain(
      `object "${CHILD_KEY}" has an identifier that does not match its key`
    );
  });

  it('rejects objects with a missing or malformed type', () => {
    const missing = validTree();
    delete missing.openmct[CHILD_KEY].type;
    expect(getImportTreeErrors(missing)).toContain(
      `object "${CHILD_KEY}" has a missing or malformed type`
    );

    ['<script>', 'type with spaces', 'x'.repeat(129), 42, { key: 'clock' }].forEach((type) => {
      const tree = validTree();
      tree.openmct[CHILD_KEY].type = type;
      expect(getImportTreeErrors(tree)).toContain(
        `object "${CHILD_KEY}" has a missing or malformed type`
      );
    });
  });

  it('rejects non-string names and locations', () => {
    const tree = validTree();
    tree.openmct[CHILD_KEY].name = { toString: 'x' };
    tree.openmct[CHILD_KEY].location = ['mine'];

    expect(getImportTreeErrors(tree)).toEqual(
      jasmine.arrayContaining([
        `object "${CHILD_KEY}" has a non-string name`,
        `object "${CHILD_KEY}" has a malformed location`
      ])
    );
  });

  it('rejects malformed composition references', () => {
    const notArray = validTree();
    notArray.openmct[ROOT_KEY].composition = { key: CHILD_KEY };
    expect(getImportTreeErrors(notArray)).toContain(
      `object "${ROOT_KEY}" has a composition that is not an array`
    );

    [null, 42, '', { key: '' }, { key: CHILD_KEY }, { namespace: '', key: 7 }].forEach(
      (reference) => {
        const tree = validTree();
        tree.openmct[ROOT_KEY].composition = [{ namespace: '', key: CHILD_KEY }, reference];
        expect(getImportTreeErrors(tree)).toContain(
          `object "${ROOT_KEY}" has a malformed composition reference at index 1`
        );
      }
    );
  });

  it('rejects malformed condition set references in object styles', () => {
    const topLevel = validTree();
    topLevel.openmct[ROOT_KEY].configuration.objectStyles.conditionSetIdentifier = { key: 9 };
    expect(getImportTreeErrors(topLevel)).toContain(
      `object "${ROOT_KEY}" has a malformed condition set reference`
    );

    const nested = validTree();
    nested.openmct[ROOT_KEY].configuration.objectStyles = {
      someLayoutItem: { conditionSetIdentifier: 42 }
    };
    expect(getImportTreeErrors(nested)).toContain(
      `object "${ROOT_KEY}" has a malformed condition set reference`
    );

    const notObject = validTree();
    notObject.openmct[ROOT_KEY].configuration.objectStyles = 'bold';
    expect(getImportTreeErrors(notObject)).toContain(
      `object "${ROOT_KEY}" has malformed object styles`
    );
  });

  it('rejects entries that are not objects', () => {
    const tree = validTree();
    tree.openmct[CHILD_KEY] = 'not an object';

    expect(getImportTreeErrors(tree)).toContain(`object "${CHILD_KEY}" is not an object`);
  });

  it('exposes the individual failures on the thrown error without leaking a stack trace in the message', () => {
    const tree = validTree();
    delete tree.openmct[CHILD_KEY].type;
    tree.openmct[CHILD_KEY].identifier = { namespace: '', key: 'mismatch' };

    let thrown;
    try {
      validateImportTree(tree);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ImportValidationError);
    expect(thrown.name).toBe('ImportValidationError');
    expect(thrown.errors.length).toBe(2);
    expect(thrown.message).toBe('Import validation failed with 2 error(s)');
  });
});
