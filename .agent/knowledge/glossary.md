# Glossary

- **domain object** — anything shown in the tree; `{ namespace, key }` identity.
- **model** — JSON-serializable state of a domain object.
- **composition** — array of child identifiers.
- **namespace** — persistence / provider partition.
- **type** — registered kind of domain object.
- **provider** — plugin implementation of an extension point.
- **datum** — one telemetry sample; a plain JS object keyed by value-metadata
  keys.
- **time system** — defines how numeric time values are interpreted and
  formatted.
- **clock** — ticking source of "now" values in a time system.
- **bounds** — `{ start, end }` window in the active time system.
- **offsets** — relative `{ start<0, end>=0 }` used with clocks in realtime
  mode.
- **view provider** — object with `{ key, canView, view(o, path) }`.
- **action provider** — context-menu / toolbar operation registration.
