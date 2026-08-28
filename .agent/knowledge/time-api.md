# Time API Notes

Modes: `'realtime'` | `'fixed'`.

- Realtime uses a clock + offsets.
- Fixed uses absolute bounds.

Offsets: `{ start: <negative>, end: >= 0 }` — relative to
`clock.currentValue()`.

## Custom clock

```js
{
  key, name, cssClass, description,
  on(event, cb),   // event === 'tick'
  off(event, cb),
  currentValue()
}
```

Register: `openmct.time.addClock(clk)`.

## Custom time system

```js
{
  key,
  name,
  cssClass,
  timeFormat,      // key of a registered format
  durationFormat,  // key of a registered format
  isUTCBased
}
```

## Deprecated — do not use in new code

- Methods: `timeSystem()`, `bounds()`, `clock()`, `clockOffsets()`,
  `stopClock()`
- Events: `'bounds'`, `'timeSystem'`, `'clock'`, `'clockOffsets'`
