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

import StorageManager from './StorageManager.js';

describe('StorageManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('without namespace', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageManager();
    });

    it('stores and retrieves items without prefix', () => {
      storage.setItem('test-key', 'test-value');
      expect(storage.getItem('test-key')).toBe('test-value');
      expect(window.localStorage.getItem('test-key')).toBe('test-value');
    });

    it('removes items without prefix', () => {
      storage.setItem('test-key', 'test-value');
      storage.removeItem('test-key');
      expect(storage.getItem('test-key')).toBeNull();
    });

    it('returns null for missing keys', () => {
      expect(storage.getItem('nonexistent')).toBeNull();
    });
  });

  describe('with namespace', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageManager('instance-1');
    });

    it('stores items with namespace prefix', () => {
      storage.setItem('test-key', 'test-value');
      expect(window.localStorage.getItem('instance-1:test-key')).toBe('test-value');
    });

    it('retrieves items using namespace prefix', () => {
      window.localStorage.setItem('instance-1:test-key', 'test-value');
      expect(storage.getItem('test-key')).toBe('test-value');
    });

    it('removes items using namespace prefix', () => {
      storage.setItem('test-key', 'test-value');
      storage.removeItem('test-key');
      expect(window.localStorage.getItem('instance-1:test-key')).toBeNull();
    });

    it('does not interfere with other namespaces', () => {
      const storage2 = new StorageManager('instance-2');
      storage.setItem('shared-key', 'value-1');
      storage2.setItem('shared-key', 'value-2');

      expect(storage.getItem('shared-key')).toBe('value-1');
      expect(storage2.getItem('shared-key')).toBe('value-2');
    });

    it('does not interfere with unprefixed keys', () => {
      window.localStorage.setItem('test-key', 'global-value');
      storage.setItem('test-key', 'namespaced-value');

      expect(window.localStorage.getItem('test-key')).toBe('global-value');
      expect(storage.getItem('test-key')).toBe('namespaced-value');
    });
  });

  describe('with empty string namespace', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageManager('');
    });

    it('behaves identically to no namespace', () => {
      storage.setItem('test-key', 'test-value');
      expect(window.localStorage.getItem('test-key')).toBe('test-value');
      expect(storage.getItem('test-key')).toBe('test-value');
    });
  });
});
