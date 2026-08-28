---
trigger: always_on
---

# Code Style (enforced by ESLint + Prettier)

Formatting (Prettier config: `.prettierrc`):

- Single quotes, no trailing commas, `printWidth: 100`, `endOfLine: auto`.

Language:

- ES modules only. `import` at top of file. No `require` in `src/`.
- `const`/`let` only, never `var`. Prefer `const`.
- `===` / `!==` only. `curly` always. No nested ternaries. No bitwise ops.
- Prefer named function declarations over arrow-assigned functions
  (`func-style: declaration`).
- One class per file (`max-classes-per-file: 1`).
- Prefer ES6 classes over prototypal patterns.
- Avoid magic numbers — hoist to named `const`s in `UPPER_SNAKE_CASE`.
- No lodash/underscore where a builtin exists (plugin
  `you-dont-need-lodash-underscore`).
- No unsanitized DOM writes (`no-unsanitized/DOM`).
- Imports must be sortable (`simple-import-sort/imports`).

Filenames (`unicorn/filename-case`):

- JS: camelCase for utility modules; PascalCase for files exporting a class or
  Vue component.
- `.vue` and files exporting classes → PascalCase (`MyThing.vue`, `MyThing.js`).

Organization: **by feature, not by type** (see CONTRIBUTING.md example).

Do NOT:

- Add or remove comments/JSDoc unless asked.
- Modify eslint/prettier config to make code pass.
- Introduce Angular, RxJS, or other frameworks. Vue 3 only.
