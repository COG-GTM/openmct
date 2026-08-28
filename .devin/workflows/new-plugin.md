---
description: Scaffold a new Open MCT plugin end-to-end
---

# New Plugin

Inputs to gather: `pluginName` (PascalCase), `namespace` (dot.notation),
whether it registers types / providers / views.

1. Create `src/plugins/<camelName>/` with:
   - `plugin.js` — export default factory returning the install function.
   - `pluginSpec.js` — colocated Jasmine spec that installs the plugin
     against `createOpenMct()` and asserts registered artifacts.
   - `README.md` — sections: "What it registers", "Files", "Installation",
     "Caveats".
2. If it registers a type:
   `openmct.types.addType('<namespace>.<key>', { name, description, cssClass, creatable })`.
3. If it registers a root object: implement an object provider class with
   `get(identifier)` and call:
   - `openmct.objects.addRoot(id, openmct.priority.LOW)`
   - `openmct.objects.addProvider(namespace, { get })`
4. If it provides telemetry: implement `supportsRequest` / `request` and/or
   `supportsSubscribe` / `subscribe`. `subscribe` must return an unsubscribe
   function.
5. Register in `src/plugins/plugins.js`: import and assign
   `plugins.<Name> = <Name>Plugin;`.
6. Add to `index.html`'s install block if it should ship in the demo.
7. Run `npm run lint` and `npm test`.

Reference: `src/plugins/conjunctionSSA/` is a full-featured template.
