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

import PersistenceError from '../../api/objects/PersistenceError.js';
import { filter__proto__ } from '../../utils/sanitization.js';

const PROVIDER = 'localStorage';

export default class LocalStorageObjectProvider {
  constructor(spaceKey = 'mct') {
    this.localStorage = window.localStorage;
    this.spaceKey = spaceKey;

    try {
      this.initializeSpace(spaceKey);
    } catch (error) {
      // reads and writes will surface a generic PersistenceError later on
      this.#persistenceError('initialize', error);
    }
  }

  get(identifier) {
    let space;

    try {
      space = this.getSpaceAsObject();
    } catch (error) {
      return Promise.reject(this.#persistenceError('read', error));
    }

    if (space?.[identifier.key] !== undefined) {
      const persistedModel = space[identifier.key];
      const domainObject = {
        identifier,
        ...persistedModel
      };

      return Promise.resolve(domainObject);
    } else {
      return Promise.resolve(undefined);
    }
  }

  getAllObjects() {
    try {
      return this.getSpaceAsObject();
    } catch (error) {
      throw this.#persistenceError('read', error);
    }
  }

  create(object) {
    return this.persistObject(object);
  }

  update(object) {
    return this.persistObject(object);
  }

  /**
   * @private
   */
  persistObject(domainObject) {
    try {
      let space = this.getSpaceAsObject();
      space[domainObject.identifier.key] = domainObject;

      this.persistSpace(space);
    } catch (error) {
      return Promise.reject(this.#persistenceError('write', error));
    }

    return Promise.resolve(true);
  }

  /**
   * Records the raw storage failure for diagnostics and returns an error whose
   * message is safe to surface to an operator.
   * @param {string} operation
   * @param {unknown} error
   * @returns {PersistenceError}
   */
  #persistenceError(operation, error) {
    console.error(`Local storage ${operation} failed for space "${this.spaceKey}":`, error);

    return new PersistenceError('Browser storage is unavailable or full.', {
      provider: PROVIDER,
      operation,
      cause: error
    });
  }

  /**
   * @private
   */
  persistSpace(space) {
    this.localStorage.setItem(this.spaceKey, JSON.stringify(space));
  }

  isReadOnly() {
    return false;
  }

  /**
   * @private
   */
  getSpace() {
    return this.localStorage.getItem(this.spaceKey);
  }

  /**
   * @private
   */
  getSpaceAsObject() {
    return JSON.parse(this.getSpace(), filter__proto__);
  }

  /**
   * @private
   */
  initializeSpace() {
    if (this.isEmpty()) {
      this.localStorage.setItem(this.spaceKey, JSON.stringify({}));
    }
  }

  /**
   * @private
   */
  isEmpty() {
    return this.getSpace() === null;
  }
}
