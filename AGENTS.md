# Agent Primer — Open MCT

Open MCT is NASA Ames' browser-based mission-control framework. It ships as an
npm library (`openmct`) and is composed almost entirely of **plugins** that
register against a stable core API (`src/api/`).

## Read first

- `README.md`, `API.md`, `TESTING.md`, `CONTRIBUTING.md`
- `.devin/rules/00-project-overview.md`
- `.agent/knowledge/architecture.md`

## Core rules

- Prefer the public API (`openmct.*`) over internal modules.
- Follow ESLint + Prettier; do not weaken lint rules to make code pass.
- Colocate `*Spec.js` unit tests with the source they test.
- Never delete or weaken tests without explicit direction.
- Vue 3 SFC components use PascalCase filenames; JS files exporting a class use
  PascalCase, other JS files use camelCase.
- Do not introduce new runtime dependencies without justification.

## Common commands

- `npm start` — dev server at <http://localhost:8080>
- `npm test` — Karma + Jasmine unit tests
- `npm run test:debug` — unit tests in a live Chrome session
- `npm run test:e2e:ci` — Playwright e2e (CI parity)
- `npm run test:e2e:local -- <grep> --debug` — local e2e iteration
- `npm run lint` / `npm run lint:fix`
- `npm run build:prod` — produce `dist/openmct.js`

Node version: see `engines.node` in `package.json` (currently `>=24.14.1`).
Use `nvm use` to select the version pinned by `.nvmrc`.

## Where things live

- `openmct.js` → `src/MCT.js` — entry point.
- `src/api/` — extension-point APIs (objects, composition, telemetry, time,
  types, actions, forms, indicators, priority, user, menu, notifications,
  tooltips, overlays, annotation, status).
- `src/plugins/` — ~66 built-in plugins, aggregated by `src/plugins/plugins.js`.
- `example/` — small illustrative plugins.
- `e2e/` — Playwright tests, fixtures, and helpers.
- `.webpack/` — webpack configs.
- `.devin/rules/` — always-on and glob-triggered agent rules.
- `.devin/workflows/` — invokable playbooks (`/name`).
- `.agent/knowledge/` — reference dossiers, opt-in.
