---
description: Triage a flaky Karma or Playwright test
---

# Debug Flaky Test

1. Reproduce locally: `npm test` or
   `npm run test:e2e:local -- <grep>`.
2. Reset workspace if needed:
   `nvm use && npm run clean && npm install`.
3. For e2e, run in the official container to match CI:

   ```sh
   docker run --rm --network host -v $(pwd):/work -w /work -it \
     mcr.microsoft.com/playwright:v<X.X.X>-jammy /bin/bash
   ```

4. Check CircleCI test insights for historical flake rate.
5. Common root causes:
   - Unresolved promises / missing `await`.
   - Animation timing (missing `renderWhenVisible` or `waitFor`).
   - Uncleaned spies (call `resetApplicationState` in `afterEach`).
   - URL hash pollution between tests.
6. Fix the root cause. Do NOT add arbitrary `waitForTimeout` — prefer
   `expect(...).toBeVisible()` or `waitFor` on observable state.
