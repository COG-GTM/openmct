---
trigger: glob
globs: e2e/**/*.js
---

# E2E Testing (Playwright)

- Tests live under `e2e/tests/{functional,visual-a11y,performance,mobile}`.
- Filename pattern: `*.e2e.spec.js`.
- Use existing fixtures from `e2e/baseFixtures.js` and helpers in `e2e/helper/`.
- Tag tests: `@a11y`, `@snapshot`, `@couchdb`, `@generatedata`, `@mobile` — CI
  filters on these tags.
- Do NOT interleave visual and functional assertions in the same spec (visual
  goes through Percy and won't run everywhere).
- For local iteration: `npm run test:e2e:local -- <grep> --debug`.
- CI parity: `npm run test:e2e:ci`.
- Prefer role/label locators over CSS selectors.
- Do not add arbitrary `waitForTimeout`. Prefer `expect(...).toBeVisible()` or
  `waitFor` on observable state.
