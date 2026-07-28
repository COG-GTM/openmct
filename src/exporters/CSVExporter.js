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

import CSV from 'comma-separated-values';
import { saveAs } from 'file-saver';

/**
 * Neutralize spreadsheet formula injection (CSV injection) for a cell value by
 * prefixing with a single quote when the value could be interpreted as a
 * formula (leading =, +, -, @, tab, CR, optionally after whitespace).
 * Numeric values (e.g. negative telemetry readings like -273.15) are returned
 * unchanged so spreadsheets still treat them as numbers.
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 * @param {*} value
 * @returns {*}
 */
export function sanitizeCsvFormulaInjection(value) {
  if (value === null || value === undefined || typeof value === 'number') {
    return value;
  }

  const str = String(value);
  if (/^\s*[=+\-@\t\r]/.test(str)) {
    const trimmed = str.trim();
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
      return value;
    }

    return `'${str}`;
  }

  return value;
}

/**
 * Encodes tabular data as CSV and triggers a browser download via FileSaver.
 *
 * Every exported cell is passed through {@link sanitizeCsvFormulaInjection} so
 * user-controlled text (object names, string telemetry values, unit metadata)
 * cannot be interpreted as a spreadsheet formula (leading `=`, `+`, `-`, `@`,
 * tab, or CR).
 */
class CSVExporter {
  /**
   * @param {Object[]} rows Each object's keys should align with the header list.
   * @param {Object} [options]
   * @param {string[]} [options.headers] Column keys and order; defaults to sorted keys of the first row.
   * @param {string} [options.filename] Download filename; defaults to `export.csv`.
   */
  export(rows, options) {
    let headers = (options && options.headers) || Object.keys(rows[0] || {}).sort();
    let filename = (options && options.filename) || 'export.csv';
    let sanitizedRows = rows.map((row) => {
      let sanitizedRow = {};
      headers.forEach((header) => {
        sanitizedRow[header] = sanitizeCsvFormulaInjection(row[header]);
      });

      return sanitizedRow;
    });
    let csvText = new CSV(sanitizedRows, { header: headers }).encode();
    let blob = new Blob([csvText], { type: 'text/csv' });
    saveAs(blob, filename);
  }
}

export default CSVExporter;
