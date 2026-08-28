# Conjunction SSA Plugin

Self-contained Open MCT plugin that streams satellite / debris state and
per-pair conjunction telemetry from a seed set of public TLEs, using a plain
Keplerian + J2 propagator (no external dependencies).

## What it registers

- **Types**
  - `conjunction.ssa.tracked-object` — a satellite or debris object.
  - `conjunction.ssa.pair` — a screened pair of tracked objects.
- **Root** `conjunction.ssa:root` containing:
  - `Tracked Objects` folder with one child per seed TLE.
  - `Conjunction Pairs` folder with one child per unordered pair.
  - `Worst-Case Conjunction` summary pair endpoint.
  - `Conjunction Watch` condition set (RED / YELLOW / GREEN).
  - `Ranked Conjunctions` telemetry table.
  - `Miss Distance vs Time` overlay plot.
  - `Conjunction Operator Layout` display layout embedding all three.
- **Telemetry provider** streaming:
  - Tracked object: `utc`, `lat` (deg), `lon` (deg), `alt` (km), `speedKmS`.
  - Pair: `utc`, `missKm`, `tcaOffsetS`, `pc`, `primary`, `secondary`, `pairKey`.

## Condition Watch thresholds

- **RED — Maneuver review**: `missKm < 5` AND `pc > 1e-4`.
- **YELLOW — Close approach**: `missKm < 25` OR `pc > 1e-6`.
- **GREEN — Nominal**: default.

## Files

- `plugin.js` — factory + install function.
- `tles.js` — seed TLE list and `parseTle`.
- `propagator.js` — Kepler solver, J2 secular rates, ECI/ECEF/geodetic.
- `pc.js` — Foster-style 2D-Gaussian analytic Pc.
- `ConjunctionEngine.js` — periodic tracked propagation, all-pair screening,
  golden-section TCA refinement, summary aggregation.
- `models.js` — pre-built domain-object models (folders, condition set, table,
  plot, layout).
- `SsaObjectProvider.js`, `SsaMetadataProvider.js`, `SsaTelemetryProvider.js`
  — Open MCT provider glue.
- `pluginSpec.js`, `propagatorSpec.js`, `pcSpec.js`,
  `ConjunctionEngineSpec.js` — Jasmine specs.

## Installation

```js
import openmct from 'openmct';
openmct.install(openmct.plugins.ConjunctionSSA());
```

Options:

- `seeds` — override the seed TLE list.
- `lookAheadSeconds` — screening window (default 1800).
- `coarseStepSeconds` — coarse propagation step (default 30).
- `tickIntervalMs` — realtime refresh cadence (default 5000).
- `pcOptions.hardBodyRadiusM` — HBR in metres (default 10).
- `pcOptions.positionSigmaM` — combined 1σ position uncertainty (default 100).
- `now` — clock override for tests.
- `autoStart: false` — do not start the periodic tick timer.

## Caveats — not for operational use

- Propagation is **two-body Kepler + J2 secular only**. No SGP4, drag, SRP,
  luni-solar, higher zonals or tesserals. Expect kilometre-scale drift within
  hours of TLE epoch.
- Geodetic conversion uses a **spherical Earth** (no WGS84 flattening).
- Probability of collision is a **Foster / Alfano-style 2D isotropic Gaussian
  approximation** with a fixed hard-body radius and diagonal position
  covariance. Real Pc calculations require the encounter-plane covariance
  projection from state-transition matrices and object dimensions.
- Seed TLEs are static snapshots for demonstration and will be stale.
- The `TEST CHASER (synthetic)` object is deliberately phased near ISS to
  exercise the RED indicator; remove it for realistic operation.
