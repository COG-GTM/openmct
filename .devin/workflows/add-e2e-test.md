---
description: Add a Playwright e2e spec
---

# Add E2E Test

1. Choose folder: `e2e/tests/functional/` (default) or
   `e2e/tests/visual-a11y/` for a11y/visual specs.
2. Filename: `<feature>.e2e.spec.js`.
3. Import from `../../baseFixtures.js` (or a more specific fixture in
   `e2e/`).
4. Use `page.goto('./')`, then interact via role/label locators (prefer
   `getByRole`, `getByLabel` over CSS selectors).
5. Tag if needed: `test('does thing @a11y', ...)` — CI grep filters use these.
6. Local run: `npm run test:e2e:local -- <grep> --debug`.
7. If snapshot-based, run inside the Playwright docker image (see
   `e2e/README.md`) to match CI rendering exactly.
