---
description: Add a Karma+Jasmine unit test alongside source
---

# Add Unit Test

1. Create `FooSpec.js` next to `Foo.js`.
2. Skeleton:

   ```js
   import { createOpenMct, resetApplicationState } from 'utils/testing';
   import MyPlugin from './plugin.js';

   describe('MyPlugin', () => {
     let openmct;

     beforeEach((done) => {
       openmct = createOpenMct();
       openmct.install(MyPlugin());
       openmct.on('start', done);
       openmct.startHeadless();
     });

     afterEach(() => resetApplicationState(openmct));

     it('registers its type', () => {
       expect(openmct.types.get('my.type')).toBeDefined();
     });
   });
   ```

3. Run `npm test` (or `npm run test:debug` for a live Chrome).
4. Do not import private modules; assert only on the public API surface.
5. Clean up any `spyOnBuiltins` via `resetApplicationState`.
