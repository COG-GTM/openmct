---
description: Pre-merge / pre-release verification
---

# Release Checks

1. `nvm use`
2. `npm run clean && npm install`
3. `npm run lint`
4. `npm test`
5. `npm run test:e2e:ci`
6. `npm run build:prod` — confirm `dist/openmct.js` is produced.
7. Verify no new large runtime deps landed in `package.json`.
8. Update copyright if crossing a year boundary
   (`npm run update-copyright-date`).
