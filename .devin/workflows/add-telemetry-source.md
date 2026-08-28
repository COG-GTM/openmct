---
description: Add a new telemetry provider (historical + realtime)
---

# Add Telemetry Source

1. Model the telemetry object: define `type`, `telemetry.values[]` with `key`,
   `name`, `format`, `hints` (domain=time, range=value). Must include a value
   whose `key` matches the active time system (`utc` by default). Use
   `source` when the raw field name differs from the metadata `key`.
2. Register an object provider that returns this object for a namespace.
3. Register a telemetry provider:
   - `supportsRequest(obj, opts)` + `request(obj, opts)` for history —
     return `Promise<Datum[]>` sorted ascending by domain.
   - `supportsSubscribe(obj)` + `subscribe(obj, cb, opts)` for realtime —
     return an unsubscribe function.
4. Handle `opts.strategy` (`latest`, `minmax`) if the backend supports it.
5. Unit-test: install plugin, mock `fetch` / network via `spyOnBuiltins`, assert
   that requesting your object yields expected datums.
6. Reference: `src/plugins/conjunctionSSA/SsaTelemetryProvider.js` and
   `example/generator/`.
