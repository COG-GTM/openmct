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

import { all, create } from 'mathjs';

/**
 * A hardened mathjs instance and helpers for safely evaluating the untrusted
 * expressions stored on `comps` (Derived Telemetry) domain objects.
 *
 * Because a comps expression is attacker-controllable (it is persisted on a
 * shared domain object and forwarded verbatim to the Comps SharedWorker), we
 * must not hand it to the full mathjs function set. This module:
 *   - disables the code-exec-adjacent parser functions per mathjs security
 *     guidance (evaluate/parse/simplify/derivative/resolve/import/createUnit),
 *   - enforces an allow-list of function/constant names so allocation-scaling
 *     constructors (zeros/ones/range/matrix/identity/...) cannot be reached,
 *   - rejects user-defined (potentially recursive) function assignments,
 *   - caps the expression length and parse-tree size to bound work.
 *
 * @see https://mathjs.org/docs/expressions/security.html
 */

const math = create(all, {});

// Capture the trusted internals before we override the insecure ones, so our
// own code can still parse/evaluate while expressions cannot call them.
const secureParse = math.parse.bind(math);
const secureEvaluate = math.evaluate.bind(math);

function disabled(name) {
  return function () {
    throw new Error(`Function "${name}" is disabled`);
  };
}

math.import(
  {
    import: disabled('import'),
    createUnit: disabled('createUnit'),
    reviver: disabled('reviver'),
    evaluate: disabled('evaluate'),
    parse: disabled('parse'),
    simplify: disabled('simplify'),
    derivative: disabled('derivative'),
    resolve: disabled('resolve')
  },
  { override: true }
);

/** Maximum number of characters permitted in a comps expression. */
export const MAX_EXPRESSION_LENGTH = 512;

/** Maximum number of nodes permitted in a parsed comps expression. */
export const MAX_EXPRESSION_NODES = 100;

// Allow-list of mathjs function names that are safe for scalar/array telemetry
// math. Anything that allocates or computes proportionally to a caller-supplied
// integer (zeros, ones, range, matrix, identity, resize, reshape, factorial,
// combinations, ...) is intentionally excluded.
const ALLOWED_FUNCTIONS = new Set([
  'abs',
  'add',
  'subtract',
  'multiply',
  'divide',
  'dotDivide',
  'dotMultiply',
  'mod',
  'unaryMinus',
  'unaryPlus',
  'pow',
  'sqrt',
  'cbrt',
  'nthRoot',
  'square',
  'cube',
  'exp',
  'expm1',
  'log',
  'log2',
  'log10',
  'log1p',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sec',
  'csc',
  'cot',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'ceil',
  'floor',
  'round',
  'fix',
  'sign',
  'min',
  'max',
  'mean',
  'median',
  'mode',
  'std',
  'variance',
  'sum',
  'prod',
  'gcd',
  'lcm',
  'hypot',
  'norm',
  'and',
  'or',
  'not',
  'xor',
  'equal',
  'unequal',
  'smaller',
  'smallerEq',
  'larger',
  'largerEq',
  'compare',
  'bitAnd',
  'bitOr',
  'bitXor',
  'bitNot',
  'leftShift',
  'rightArithShift',
  'rightLogShift',
  'isNaN',
  'isPositive',
  'isNegative',
  'isZero',
  'isInteger',
  'number'
]);

// Allow-list of mathjs constant names.
const ALLOWED_CONSTANTS = new Set([
  'pi',
  'tau',
  'e',
  'phi',
  'PI',
  'E',
  'LN2',
  'LN10',
  'LOG2E',
  'LOG10E',
  'SQRT1_2',
  'SQRT2',
  'Infinity',
  'NaN',
  'true',
  'false',
  'null'
]);

/**
 * Validate an untrusted comps expression before evaluation.
 *
 * @param {string} expression the raw, attacker-controllable expression
 * @param {string[]} [scopeNames] names defined in the evaluation scope
 *        (parameter names). These are always permitted as symbols.
 * @throws {Error} if the expression is malformed, too large, or references a
 *         disallowed mathjs function/constant or a function definition.
 */
export function validateExpression(expression, scopeNames = []) {
  if (typeof expression !== 'string') {
    throw new Error('Expression must be a string');
  }
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`);
  }

  const allowedSymbols = new Set(scopeNames);
  const parsed = secureParse(expression);

  let nodeCount = 0;
  parsed.traverse((node) => {
    nodeCount += 1;
    if (nodeCount > MAX_EXPRESSION_NODES) {
      throw new Error(`Expression exceeds maximum complexity of ${MAX_EXPRESSION_NODES} nodes`);
    }

    // Disallow user-defined functions, which enable unbounded recursion.
    if (node.isFunctionAssignmentNode) {
      throw new Error('Function definitions are not allowed in expressions');
    }

    if (node.isSymbolNode || node.isFunctionNode) {
      const name = node.name;
      // Names provided by the evaluation scope (parameters) are always allowed.
      if (allowedSymbols.has(name)) {
        return;
      }
      // A name that is not a mathjs builtin is treated as a scope reference;
      // evaluation will throw if it is genuinely undefined.
      if (math[name] === undefined) {
        return;
      }
      if (node.isFunctionNode) {
        if (!ALLOWED_FUNCTIONS.has(name)) {
          throw new Error(`Function "${name}" is not allowed in expressions`);
        }
      } else if (!ALLOWED_CONSTANTS.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
        throw new Error(`Symbol "${name}" is not allowed in expressions`);
      }
    }
  });
}

/**
 * Evaluate an expression against a scope using the hardened mathjs instance.
 *
 * The insecure parser functions are disabled on this instance, but callers are
 * still responsible for having validated the expression content (via
 * {@link validateExpression}) at least once beforehand. Prefer
 * {@link evaluateExpression} for one-shot use.
 *
 * @param {string} expression
 * @param {Object} [scope] mapping of parameter names to values
 * @returns {*} the computed value
 */
export function evaluate(expression, scope = {}) {
  return secureEvaluate(expression, scope);
}

/**
 * Validate and evaluate an untrusted comps expression against a scope.
 *
 * @param {string} expression the raw, attacker-controllable expression
 * @param {Object} [scope] mapping of parameter names to values
 * @returns {*} the computed value
 */
export function evaluateExpression(expression, scope = {}) {
  validateExpression(expression, Object.keys(scope));
  return secureEvaluate(expression, scope);
}
