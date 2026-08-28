# `openmct.*` Cheat Sheet

## Bootstrapping

```js
openmct.install(plugin);
openmct.start(elOrSelector);
```

## Types

```js
openmct.types.addType(key, {
  name, description, cssClass, creatable, initialize
});
openmct.types.get(key);
```

## Objects

```js
openmct.objects.addRoot(idOrFn, priority);
openmct.objects.addProvider(namespace, { get(identifier) });
openmct.objects.get(identifier);
openmct.objects.mutate(obj, path, value);
```

## Composition

```js
openmct.composition.addProvider({ appliesTo(obj), load(obj) });
openmct.composition.get(obj); // returns CompositionCollection
```

## Telemetry

```js
openmct.telemetry.addProvider({
  supportsRequest(o, opts), request(o, opts),
  supportsSubscribe(o),     subscribe(o, cb, opts),
  supportsMetadata(o),      getMetadata(o),
  supportsLimits(o),        getLimitEvaluator(o)
});
openmct.telemetry.addFormat({ key, format, parse, validate });
openmct.telemetry.request(obj, opts);
openmct.telemetry.subscribe(obj, cb, opts);
```

## Time

```js
openmct.time.addTimeSystem(sys);
openmct.time.setTimeSystem(key, bounds);
openmct.time.getTimeSystem();

openmct.time.addClock(clk);
openmct.time.setClock(clk, offsets);
openmct.time.getClock();

openmct.time.setBounds(b);        openmct.time.getBounds();
openmct.time.setClockOffsets(o);  openmct.time.getClockOffsets();
openmct.time.setMode('realtime' | 'fixed');
openmct.time.getMode();
openmct.time.isRealTime();
openmct.time.isFixed();
```

Events: `boundsChanged`, `timeSystemChanged`, `clockChanged`,
`clockOffsetsChanged`, `modeChanged`.

## Indicators

```js
const ind = openmct.indicators.simpleIndicator();
ind.text('…').iconClass('icon-info');
openmct.indicators.add(ind); // or add({ element })
```

## Priority

`openmct.priority.HIGHEST | HIGH | DEFAULT | LOW | LOWEST`
