---
description: Register a new domain-object type
---

# Add Object Type

1. Pick a namespaced key: `<vendor>.<name>`.
2. Register:

   ```js
   openmct.types.addType(key, {
     name,
     description,
     cssClass,
     creatable,
     initialize(model) {
       // default fields on new instances
     }
   });
   ```

3. If `creatable: true`, add form fields via `openmct.forms` if needed.
4. Provide a view:
   `openmct.objectViews.addProvider({ key, name, canView, view })`.
5. Test: install plugin, `expect(openmct.types.get(key)).toBeDefined()` and
   assert the view provider returns a view for objects of that type.
