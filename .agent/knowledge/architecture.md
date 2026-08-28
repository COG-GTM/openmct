# Architecture — Mental Model

Open MCT is a **framework core** + **plugin registry**.

Core (`src/MCT.js` → `src/api/*`) owns:

- object registry & providers
- composition graph
- telemetry pipeline
- time system + clocks
- view / action / indicator / form / menu / notification registries
- priority scheme

Plugins add:

- types (kinds of objects)
- object providers (how to fetch models by identifier)
- composition providers (what children an object has)
- telemetry providers (historical + realtime data)
- view providers (how to render an object)
- action providers (context-menu / toolbar operations)
- indicators, formatters, time systems, clocks

Data flow for a plot:

1. Time bounds change → view calls `openmct.telemetry.request(obj, opts)`.
2. Matching provider returns `Datum[]` → view renders history.
3. Provider is also subscribed → new datums pushed → view appends live.

Domain-object identity:
`{ namespace, key }` — namespace usually maps 1:1 to a persistence store
or a plugin's synthetic root.
