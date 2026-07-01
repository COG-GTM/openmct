# Conjunction SSA Plugin

A self-contained Space Situational Awareness (SSA) conjunction-screening plugin
for Open MCT. It seeds a set of TLE-driven tracked objects (satellites and
debris), propagates their orbits in-browser, screens every pair for close
approaches, and surfaces the results through live/historical telemetry, a
threat-classifying condition set, and a ready-made operator display layout.

Everything runs client-side with **no external npm dependencies** and **no
network calls** — the TLE seed data and all orbital-mechanics math are
implemented in-repo.

## Installation

```js
import ConjunctionSSAPlugin from './plugins/conjunctionSSA/plugin.js';

openmct.install(openmct.plugins.ConjunctionSSA());
```

After installation the object tree shows a **Conjunction SSA** root folder
containing:

- the seed **Tracked Objects** (ISS, two Starlink satellites, two debris
  objects),
- a **Conjunction Watch** condition set, and
- a **Conjunction Operator View** display layout (ranked table + miss-distance
  plot + RED/YELLOW/GREEN status widget).

## Contents

| File | Responsibility |
| --- | --- |
| `plugin.js` | Factory / `install(openmct)`; registers the type, telemetry provider, object + composition providers, and seeds all objects. |
| `seedObjects.js` | Seed tracked objects defined by real public TLEs. |
| `OrbitPropagator.js` | TLE parsing + Keplerian propagation with J2 secular perturbations; ECI and geodetic (lat/lon/alt) output. |
| `ConjunctionEngine.js` | Pairwise close-approach screening: miss distance, time of closest approach, and simplified probability of collision. |
| `ConjunctionTelemetryProvider.js` | Real-time (`subscribe`) and historical (`request`) telemetry. |
| `conditionSetConfig.js` | Builds the `Conjunction Watch` condition set (RED/YELLOW/GREEN). |
| `layoutConfig.js` | Builds the operator layout and its embedded table, plot, and status widget. |

## TLE source

The seed two-line element sets in `seedObjects.js` are modeled on real public
catalog objects published by [CelesTrak](https://celestrak.org). **TLEs are
epoch-specific** — the values here are illustrative and can be refreshed at any
time by pasting current lines from CelesTrak. The Starlink pair is intentionally
placed on near-coplanar orbits with a slightly different mean motion so that a
genuine close approach occurs within the screening window (this is what drives
the RED "Maneuver review" alert in the demo).

## Orbit propagation

`OrbitPropagator` recovers the classical orbital elements from a TLE, converts
mean motion to a semi-major axis via Kepler's third law
(`a = (μ / n²)^(1/3)`, `μ = 398600.4418 km³/s²`), and applies first-order **J2
secular** rates (`J2 = 1.08262668e-3`, `Rₑ = 6378.137 km`) to the RAAN, argument
of perigee, and mean anomaly. Kepler's equation is solved by Newton iteration;
the position is computed in the perifocal frame and rotated to ECI using the
(perturbed) RAAN / inclination / argument-of-perigee 3-1-3 sequence.
`getGeodetic()` rotates ECI to ECEF via GMST and converts to WGS84
latitude / longitude / altitude. The model is intentionally simplified
(no drag, SRP, or higher-order gravity) — adequate for demonstration, not for
operational flight dynamics.

## Simplified probability-of-collision model

The `probability_of_collision` value is a deliberately simple, single-parameter
Gaussian ("foliage") approximation and is **not** a substitute for a proper 2D
Pc integral computed in the conjunction plane from the combined state
covariance. Given a miss distance `d`, it assumes:

- a combined **hard-body radius** `HBR` (sum of both objects' bounding spheres),
  and
- an isotropic 1-sigma relative position uncertainty `σ`,

and uses the maximum-probability form:

```
Pc ≈ (HBR² / (2·σ²)) · exp( −d² / (2·σ²) )
```

The defaults (`HBR = 0.05 km`, `σ = 1.0 km`) are chosen so that a sub-kilometer
miss produces a Pc in the `1e-4`–`1e-3` range. These are demonstration
assumptions, not accredited screening parameters.

## Threat classification

The `Conjunction Watch` condition set classifies the primary tracked object's
worst-case conjunction. Conditions are evaluated in order (first match wins):

1. **RED — `Maneuver review`**: `miss_distance_km < 5` **and**
   `probability_of_collision > 1e-4`.
2. **YELLOW — `Watch`**: `miss_distance_km < 25`.
3. **GREEN — `Clear`** (default).

The operator view's status widget maps these outputs to red / yellow / green
styling.
