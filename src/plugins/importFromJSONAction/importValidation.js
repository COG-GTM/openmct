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

import { makeKeyString } from 'objectUtils';

/**
 * Property names that can alter the prototype chain of an object when they are
 * assigned to, and are never legitimate keys in an exported object tree.
 */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Type keys are interpolated into CSS class names (`is-object-type-<type>`) and
 * used as registry lookup keys, so they are restricted to the characters every
 * type registered in this repository already uses. Identifier and depth bounds
 * exist to cap the work a hostile file can demand; they are an order of
 * magnitude above what exported object trees produce.
 */
const TYPE_KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_ERRORS = 20;
const MAX_DEPTH = 64;

/**
 * Operator-facing message shown whenever an import file is rejected. It is
 * intentionally generic; the specific reasons are logged for diagnostics only.
 */
const IMPORT_REJECTED_MESSAGE =
  'Import failed: the selected file is not a valid Open MCT export or contains unsupported content.';

class ImportValidationError extends Error {
  /**
   * @param {string[]} errors the individual validation failures
   */
  constructor(errors) {
    super(`Import validation failed with ${errors.length} error(s)`);
    this.name = 'ImportValidationError';
    this.errors = errors;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value, maxLength = MAX_IDENTIFIER_LENGTH) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function describe(path) {
  return path.length ? path.join('.') : '<root>';
}

/**
 * Walks every own property of a JSON value and reports reserved keys anywhere
 * in the graph (including nested configuration blobs). Nesting deeper than
 * MAX_DEPTH is rejected outright so a hostile file cannot exhaust the stack.
 */
function collectReservedKeys(value, path, errors) {
  if (errors.length >= MAX_ERRORS) {
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  if (path.length >= MAX_DEPTH) {
    errors.push(`Nesting deeper than ${MAX_DEPTH} levels at ${describe(path)}`);

    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && errors.length < MAX_ERRORS; index++) {
      collectReservedKeys(value[index], [...path, `[${index}]`], errors);
    }

    return;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (errors.length >= MAX_ERRORS) {
      return;
    }

    if (RESERVED_KEYS.has(key)) {
      errors.push(`Reserved property "${key}" is not allowed at ${describe(path)}`);
      continue;
    }

    collectReservedKeys(value[key], [...path, key], errors);
  }
}

/**
 * A reference may be a key string or an identifier object.
 * @returns {string|undefined} a normalized key string, or undefined if invalid
 */
function normalizeReference(reference) {
  if (isNonEmptyString(reference)) {
    return reference;
  }

  if (
    isPlainObject(reference) &&
    isNonEmptyString(reference.key) &&
    typeof reference.namespace === 'string' &&
    reference.namespace.length <= MAX_IDENTIFIER_LENGTH
  ) {
    return makeKeyString(reference);
  }

  return undefined;
}

function validateDomainObjectModel(keyString, model, errors) {
  const where = `object "${keyString}"`;

  if (!isPlainObject(model)) {
    errors.push(`${where} is not an object`);

    return;
  }

  const identifierKeyString = normalizeReference(model.identifier);
  if (identifierKeyString === undefined || !isPlainObject(model.identifier)) {
    errors.push(`${where} has a missing or malformed identifier`);
  } else if (identifierKeyString !== keyString) {
    errors.push(`${where} has an identifier that does not match its key`);
  }

  if (!isNonEmptyString(model.type, 128) || !TYPE_KEY_PATTERN.test(model.type)) {
    errors.push(`${where} has a missing or malformed type`);
  }

  if (model.name !== undefined && typeof model.name !== 'string') {
    errors.push(`${where} has a non-string name`);
  }

  if (
    model.location !== undefined &&
    model.location !== null &&
    typeof model.location !== 'string'
  ) {
    errors.push(`${where} has a malformed location`);
  }

  if (model.composition !== undefined) {
    if (!Array.isArray(model.composition)) {
      errors.push(`${where} has a composition that is not an array`);
    } else {
      model.composition.forEach((reference, index) => {
        if (normalizeReference(reference) === undefined) {
          errors.push(`${where} has a malformed composition reference at index ${index}`);
        }
      });
    }
  }

  const objectStyles = model.configuration?.objectStyles;
  if (objectStyles !== undefined) {
    if (!isPlainObject(objectStyles)) {
      errors.push(`${where} has malformed object styles`);
    } else {
      const styleEntries = [objectStyles, ...Object.values(objectStyles)];
      styleEntries.forEach((entry) => {
        const conditionSetIdentifier = entry?.conditionSetIdentifier;
        if (
          conditionSetIdentifier !== undefined &&
          normalizeReference(conditionSetIdentifier) === undefined
        ) {
          errors.push(`${where} has a malformed condition set reference`);
        }
      });
    }
  }
}

/**
 * Validates a parsed Import-from-JSON payload before any of it is persisted.
 *
 * Structural rules enforced:
 *  - top level is a plain object with an `openmct` object map and a `rootId` string
 *  - `rootId` refers to an entry of `openmct`
 *  - no `__proto__`, `constructor` or `prototype` keys anywhere in the graph
 *  - each entry has an identifier matching its key, a well-formed type key,
 *    and well-formed composition / condition set references
 *
 * @param {unknown} tree the parsed JSON payload
 * @returns {string[]} an empty array when valid, otherwise the list of failures
 */
function getImportTreeErrors(tree) {
  const errors = [];

  if (!isPlainObject(tree)) {
    return ['Import payload is not an object'];
  }

  collectReservedKeys(tree, [], errors);
  if (errors.length) {
    return errors;
  }

  if (!isPlainObject(tree.openmct)) {
    errors.push('Import payload is missing the "openmct" object map');
  }

  if (!isNonEmptyString(tree.rootId)) {
    errors.push('Import payload is missing a "rootId"');
  }

  if (errors.length) {
    return errors;
  }

  const entries = Object.entries(tree.openmct);
  if (entries.length === 0) {
    errors.push('Import payload does not contain any objects');
  }

  if (!Object.hasOwn(tree.openmct, tree.rootId)) {
    errors.push('Import payload "rootId" does not refer to an object in the payload');
  }

  for (const [keyString, model] of entries) {
    if (errors.length >= MAX_ERRORS) {
      break;
    }

    validateDomainObjectModel(keyString, model, errors);
  }

  return errors;
}

/**
 * @param {unknown} tree the parsed JSON payload
 * @throws {ImportValidationError} when the payload is not a well-formed export
 */
function validateImportTree(tree) {
  const errors = getImportTreeErrors(tree);

  if (errors.length) {
    throw new ImportValidationError(errors);
  }

  return tree;
}

export {
  getImportTreeErrors,
  IMPORT_REJECTED_MESSAGE,
  ImportValidationError,
  RESERVED_KEYS,
  validateImportTree
};
