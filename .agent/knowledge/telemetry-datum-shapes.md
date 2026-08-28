# Telemetry Metadata & Datums

## Telemetry object

```js
{
  identifier: { namespace, key },
  name,
  type,
  telemetry: {
    values: [
      { key: 'utc', source: 'timestamp', format: 'utc', hints: { domain: 1 } },
      {
        key: 'value',
        name: 'Value',
        unit: 'kg',
        format: 'float',
        min: 0,
        max: 100,
        hints: { range: 1 }
      }
    ]
  }
}
```

## Datum shape

Keys match `telemetry.values[].source` (or `key` if no `source`):

```js
{ timestamp: 1712345678000, value: 42 }
```

## Rules

- Exactly one value MUST have `hints.domain` and must correspond to the active
  time system's key (map with `source` if the raw field name differs).
- `request()` returns `Promise<Datum[]>`, sorted ascending by domain.
- `subscribe()` returns an unsubscribe function; each callback receives
  exactly one datum.
- For enums: `format: 'enum'` + `enumerations: [{ value, string }]`.
- For arrays: `format: 'number[]'` or `format: 'string[]'`.
