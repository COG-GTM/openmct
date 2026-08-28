---
trigger: glob
globs: src/**/*.js,src/**/*.vue
---

# Open MCT API Usage

- Access APIs through the `openmct` instance passed to plugin installers or via
  the framework — do NOT import from `src/api/*` directly in plugin code.
- Telemetry datums must include a value keyed to the active time system's `key`
  (default `utc`). Metadata declares this via `telemetry.values[].hints.domain`.
- Telemetry providers must return arrays sorted ascending by domain from
  `request()`, and must return an unsubscribe function from `subscribe()`.
- View providers should use the `renderWhenVisible(fn)` helper from
  `viewOptions` instead of raw `requestAnimationFrame` (see `API.md`).
- Prefer `openmct.priority.*` constants over raw numeric priorities.
- Time API: use `getTimeSystem`/`setTimeSystem`, `getBounds`/`setBounds`,
  `getClock`/`setClock`, `getMode`/`setMode`. Deprecated single-name methods
  (`timeSystem()`, `bounds()`, `clock()`, `clockOffsets()`, `stopClock()`)
  must not be used in new code.
- Events: `boundsChanged`, `timeSystemChanged`, `clockChanged`,
  `clockOffsetsChanged`, `modeChanged` — the un-suffixed versions are deprecated.
