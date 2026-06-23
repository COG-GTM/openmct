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

/**
 * StorageManager provides a namespaced interface to window.localStorage.
 * When multiple Open MCT instances run on the same host:port, each instance
 * can use a unique namespace to prevent key collisions.
 */
export default class StorageManager {
  /**
   * @param {string} namespace - Optional prefix for all keys. When empty,
   *   keys are stored without a prefix (backward-compatible default).
   */
  constructor(namespace = '') {
    this.namespace = namespace;
  }

  /**
   * @private
   */
  _prefixKey(key) {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  getItem(key) {
    return window.localStorage.getItem(this._prefixKey(key));
  }

  setItem(key, value) {
    window.localStorage.setItem(this._prefixKey(key), value);
  }

  removeItem(key) {
    window.localStorage.removeItem(this._prefixKey(key));
  }
}
