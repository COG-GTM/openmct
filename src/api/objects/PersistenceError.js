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
 * Represents a failure in a persistence provider (for example an unreachable
 * database, a rejected request, or unavailable browser storage).
 *
 * The `message` is intentionally generic and safe to display to an operator.
 * Raw provider details (status codes, server-supplied reasons, stack traces)
 * are recorded by the provider via `console.error` and are not carried on the
 * message so they cannot leak into notifications or dialogs.
 */
export default class PersistenceError extends Error {
  static GENERIC_MESSAGE = 'The requested storage operation could not be completed.';

  /**
   * @param {string} [message] operator-safe message
   * @param {{ provider?: string, operation?: string, status?: number, cause?: unknown }} [options]
   */
  constructor(
    message = PersistenceError.GENERIC_MESSAGE,
    { provider, operation, status, cause } = {}
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PersistenceError';
    this.provider = provider;
    this.operation = operation;
    this.status = status;
  }
}
