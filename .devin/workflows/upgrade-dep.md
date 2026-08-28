---
description: Upgrade a dependency safely
---

# Upgrade Dependency

1. Check `browserslist` compatibility in `package.json`.
2. `npm i <pkg>@<version>` — update lockfile.
3. Read release notes for breaking changes.
4. `npm run lint && npm test && npm run test:e2e:ci`.
5. `npm run build:prod`, then manually smoke-test with `npm start`.
6. If it affects `d3`, `plotly`, `vue`, `webpack`, `playwright`, or `karma`,
   flag for extra review — these touch many files.
