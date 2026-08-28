---
trigger: glob
globs: **/*Spec.js
---

# Unit Testing (Karma + Jasmine)

- Colocate `FooSpec.js` next to `Foo.js`. For plugins, start with
  `pluginSpec.js` at the plugin root; split as it grows.
- Prefer public API + browser builtins. Do NOT reach into private modules.
- Install the plugin under test in `beforeEach` via `createOpenMct()` from
  `src/utils/testing.js`. Tear down with `resetApplicationState(openmct)` in
  `afterEach`.
- Declare state inside block scope; initialize in `beforeEach` (not
  `beforeAll`) to avoid state leakage between tests.
- Use `spyOnBuiltins` + `clearBuiltinSpies` (called via
  `resetApplicationState`) when wrapping `window`/globals.
- Use `getMockObjects`, `getMockTelemetry`, `getLatestTelemetry` helpers where
  they fit — extend `setMockObjects()` for new mock shapes.
- Test the plugin's public effects (types added, objects available, telemetry
  callbacks invoked) — not internal implementation details.
- Run: `npm test`. Debug: `npm run test:debug`.
