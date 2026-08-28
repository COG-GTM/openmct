---
description: Add a view provider for a domain-object type
---

# Add View

1. Create `MyView.vue` under `components/`.
2. Implement view provider:
   - `key`, `name`, `cssClass`
   - `canView(domainObject)` → boolean
   - `view(domainObject, objectPath)` → `{ show(el, isEditing, viewOptions), destroy() }`
3. In `show`, mount a Vue app into `element`. Wrap animation work in
   `viewOptions.renderWhenVisible(fn)` so it defers while offscreen.
4. In `destroy`, unmount the app and remove listeners / subscriptions.
5. Register: `openmct.objectViews.addProvider(provider)`.
6. Reference: `src/plugins/gauge/GaugeViewProvider.js` for a minimal view;
   `src/plugins/plot/` for a large, telemetry-driven one.
