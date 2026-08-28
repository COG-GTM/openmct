# Reference Plugins (Guided Tours)

- `src/plugins/conjunctionSSA/` — full example: types, root, object provider,
  composition tree, telemetry (subscribe + request), condition set, layout.
  Read its `README.md` for the walkthrough.
- `src/plugins/telemetryTable/` — view-heavy plugin backed by a telemetry
  source. Good template for tabular views.
- `src/plugins/gauge/` — smaller view provider example with a composition
  policy and a substantial spec file (`GaugePluginSpec.js`).
- `src/plugins/plot/` — largest view plugin; look here for time-series
  rendering patterns and `minmax` strategy handling.
- `src/plugins/condition/` — rule-engine style; useful for derived state.
- `src/plugins/utcTimeSystem/` — the canonical time-system + clock plugin.
- `example/generator/` — synthetic telemetry source; ideal for scaffolding
  new telemetry providers.
