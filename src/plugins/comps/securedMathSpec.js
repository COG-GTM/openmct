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

import { evaluateExpression, MAX_EXPRESSION_LENGTH, validateExpression } from './securedMath.js';

describe('securedMath', () => {
  describe('evaluateExpression', () => {
    it('evaluates simple arithmetic against a scope', () => {
      expect(evaluateExpression('a * 2', { a: 3 })).toBe(6);
    });

    it('supports allow-listed functions and constants', () => {
      expect(evaluateExpression('min(a, b) + max(a, b)', { a: 2, b: 5 })).toBe(7);
      expect(evaluateExpression('sqrt(a)', { a: 16 })).toBe(4);
      expect(evaluateExpression('round(cos(0))', {})).toBe(1);
    });
  });

  describe('validateExpression', () => {
    it('rejects non-string expressions', () => {
      expect(() => validateExpression(42)).toThrow();
      expect(() => validateExpression(null)).toThrow();
      expect(() => validateExpression({})).toThrow();
    });

    it('rejects expressions exceeding the length cap', () => {
      const tooLong = `${'a'.repeat(MAX_EXPRESSION_LENGTH + 1)}`;
      expect(() => validateExpression(tooLong, ['a'])).toThrow();
    });

    it('rejects allocation-scaling matrix/array constructors', () => {
      ['zeros(1e9)', 'ones(1e6, 1e6)', 'range(0, 1e12)', 'matrix([1, 2, 3])'].forEach(
        (expression) => {
          expect(() => validateExpression(expression)).toThrow();
        }
      );
    });

    it('rejects user-defined (potentially recursive) function assignments', () => {
      expect(() => validateExpression('f(x) = f(x)')).toThrow();
    });

    it('rejects the code-exec-adjacent parser functions', () => {
      ['evaluate("2+2")', 'parse("2+2")', 'simplify("x+x")', 'import({})'].forEach((expression) => {
        expect(() => validateExpression(expression)).toThrow();
      });
    });

    it('rejects mathjs builtins that are not allow-listed', () => {
      expect(() => validateExpression('factorial(a)', ['a'])).toThrow();
    });

    it('permits scope parameter names as symbols', () => {
      expect(() => validateExpression('a + b', ['a', 'b'])).not.toThrow();
    });
  });

  it('does not allow disabled functions to be evaluated even when parsed', () => {
    expect(() => evaluateExpression('zeros(1e9)')).toThrow();
  });
});
