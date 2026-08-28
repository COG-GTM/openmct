---
trigger: glob
globs: src/plugins/**
---

# Plugin Authoring Rules

A plugin is a factory returning an install function:

```js
export default function MyPlugin(options) {
  return function install(openmct) {
    // register types, providers, views, actions...
  };
}
```

Structure:

- Folder per plugin: `src/plugins/<pluginName>/`.
- Entry: `plugin.js` exporting `default` factory.
- Register in `src/plugins/plugins.js` as `plugins.MyPlugin = MyPlugin;`.
- Colocate `pluginSpec.js` at the plugin root. Split when it grows too large.
- Vue SFCs in `components/` subfolder; PascalCase filenames.
- SCSS colocated (e.g. `myPlugin.scss`), imported from JS where needed.

Namespaces & identifiers:

- Always namespace your type keys (e.g. `myorg.thing`) to avoid collisions.
- Object identifiers are `{ namespace, key }`; keys are unique within a namespace.

Providers to know:

- `openmct.types.addType(key, def)`
- `openmct.objects.addRoot(idOrFn, priority)` +
  `openmct.objects.addProvider(namespace, { get })`
- `openmct.composition.addProvider({ appliesTo, load })`
- `openmct.telemetry.addProvider({ supportsRequest, request, supportsSubscribe, subscribe, ... })`
- `openmct.time.addTimeSystem(...)`, `openmct.time.addClock(...)`
- `openmct.indicators.add(...)`, `openmct.priority.HIGH|LOW|...`

Reference plugins:

- `src/plugins/conjunctionSSA/` — full end-to-end example (types, root,
  object provider, composition, telemetry, condition set, layout).
- `src/plugins/telemetryTable/` — view-heavy plugin backed by a telemetry source.
- `src/plugins/gauge/` — smaller view provider with composition policy.
