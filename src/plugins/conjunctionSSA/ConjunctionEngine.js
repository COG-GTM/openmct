/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

/**
 * Conjunction screening engine.
 *
 * Given orbit propagators for a set of tracked objects, the engine screens
 * every unique pair for close approaches over a forward time window and
 * derives, for each object, the "worst" (closest) conjunction it participates
 * in:
 *
 *  - `miss_distance_km`: the minimum 3D separation of the pair over the window.
 *  - `tca`: the time of closest approach (UTC epoch, ms).
 *  - `probability_of_collision`: a simplified collision-probability estimate.
 *
 * Screening is coarse-then-fine: positions are sampled at a fixed cadence over
 * the window to bracket the minimum separation, then the bracket is refined at
 * a finer cadence to locate the time of closest approach more precisely.
 */

// Screening window / cadence parameters.
const WINDOW_MS = 24 * 60 * 60 * 1000; // screen 24h forward
const COARSE_STEP_MS = 30 * 1000; // 30s coarse cadence
const FINE_STEP_MS = 1000; // 1s refinement cadence
const SCREEN_REFRESH_MS = 60 * 1000; // recompute a pair at most this often

/**
 * Simplified probability-of-collision model parameters.
 *
 * This is a deliberately simple, single-parameter Gaussian ("foliage")
 * approximation and is NOT a substitute for a proper 2D Pc integral computed
 * in the conjunction plane from the combined state covariance. It assumes:
 *   - a combined hard-body radius (sum of both objects' bounding spheres), and
 *   - an isotropic 1-sigma position uncertainty on the relative miss vector.
 * The maximum-probability form is used:
 *   Pc ≈ (HBR^2 / (2 σ^2)) · exp( -d^2 / (2 σ^2) )
 * where d is the miss distance. Values are clamped to [0, 1].
 */
const HARD_BODY_RADIUS_KM = 0.05; // combined hard-body radius (~50 m)
const POSITION_SIGMA_KM = 1.0; // 1-sigma relative position uncertainty

/**
 * @typedef {Object} TrackedObject
 * @property {string} key
 * @property {string} name
 * @property {'satellite'|'debris'} category
 * @property {import('./OrbitPropagator.js').default} propagator
 */

/**
 * @typedef {Object} ConjunctionResult
 * @property {number} missDistanceKm
 * @property {number} tca time of closest approach, ms since epoch
 * @property {number} probabilityOfCollision
 * @property {string} partnerKey key of the conjuncting object
 * @property {string} partnerName name of the conjuncting object
 */

export default class ConjunctionEngine {
  /**
   * @param {TrackedObject[]} trackedObjects
   */
  constructor(trackedObjects) {
    this.objects = trackedObjects;
    this.objectsByKey = new Map(trackedObjects.map((obj) => [obj.key, obj]));
    // Cache of screened pair results, keyed by "keyA|keyB".
    this.pairCache = new Map();
  }

  /**
   * Simplified collision probability from a miss distance.
   * @param {number} missDistanceKm
   * @returns {number}
   */
  static probabilityOfCollision(missDistanceKm) {
    const sigma2 = POSITION_SIGMA_KM * POSITION_SIGMA_KM;
    const prefactor = (HARD_BODY_RADIUS_KM * HARD_BODY_RADIUS_KM) / (2 * sigma2);
    const pc = prefactor * Math.exp(-(missDistanceKm * missDistanceKm) / (2 * sigma2));

    return Math.min(1, Math.max(0, pc));
  }

  /**
   * 3D separation (km) between two objects at a given time.
   * @param {TrackedObject} objA
   * @param {TrackedObject} objB
   * @param {number} timestampMs
   * @returns {number}
   */
  static separation(objA, objB, timestampMs) {
    const a = objA.propagator.getECI(timestampMs);
    const b = objB.propagator.getECI(timestampMs);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Screen a single pair for its closest approach over the forward window
   * beginning at `referenceMs`. Results are cached and only recomputed once
   * per {@link SCREEN_REFRESH_MS}.
   *
   * @param {TrackedObject} objA
   * @param {TrackedObject} objB
   * @param {number} referenceMs window start
   * @returns {ConjunctionResult}
   */
  screenPair(objA, objB, referenceMs) {
    const cacheKey = [objA.key, objB.key].sort().join('|');
    const cached = this.pairCache.get(cacheKey);
    if (cached && Math.abs(referenceMs - cached.computedAt) < SCREEN_REFRESH_MS) {
      return cached.result;
    }

    // Coarse pass: bracket the minimum separation.
    let minSeparation = Infinity;
    let minTime = referenceMs;
    const end = referenceMs + WINDOW_MS;
    for (let t = referenceMs; t <= end; t += COARSE_STEP_MS) {
      const separation = ConjunctionEngine.separation(objA, objB, t);
      if (separation < minSeparation) {
        minSeparation = separation;
        minTime = t;
      }
    }

    // Fine pass: refine around the coarse minimum (never before the window start).
    const refineStart = Math.max(referenceMs, minTime - COARSE_STEP_MS);
    const refineEnd = Math.min(end, minTime + COARSE_STEP_MS);
    for (let t = refineStart; t <= refineEnd; t += FINE_STEP_MS) {
      const separation = ConjunctionEngine.separation(objA, objB, t);
      if (separation < minSeparation) {
        minSeparation = separation;
        minTime = t;
      }
    }

    const result = {
      missDistanceKm: minSeparation,
      tca: minTime,
      probabilityOfCollision: ConjunctionEngine.probabilityOfCollision(minSeparation)
    };

    this.pairCache.set(cacheKey, { computedAt: referenceMs, result });

    return result;
  }

  /**
   * Find the worst (closest) conjunction that the given object participates in,
   * screened over the window beginning at `referenceMs`.
   *
   * @param {string} key object key
   * @param {number} referenceMs
   * @returns {ConjunctionResult|null}
   */
  getWorstForObject(key, referenceMs) {
    const object = this.objectsByKey.get(key);
    if (!object) {
      return null;
    }

    let worst = null;
    for (const other of this.objects) {
      if (other.key === key) {
        continue;
      }
      const pair = this.screenPair(object, other, referenceMs);
      if (!worst || pair.missDistanceKm < worst.missDistanceKm) {
        worst = {
          missDistanceKm: pair.missDistanceKm,
          tca: pair.tca,
          probabilityOfCollision: pair.probabilityOfCollision,
          partnerKey: other.key,
          partnerName: other.name
        };
      }
    }

    return worst;
  }

  /**
   * Build a full telemetry datum for an object at a point in time: its
   * geodetic position plus the worst conjunction values screened forward from
   * that time.
   *
   * @param {string} key object key
   * @param {number} timestampMs sample time (also the screening window start)
   * @returns {Object|null} datum keyed by telemetry metadata keys
   */
  getObjectDatum(key, timestampMs) {
    const object = this.objectsByKey.get(key);
    if (!object) {
      return null;
    }

    const geo = object.propagator.getGeodetic(timestampMs);
    const worst = this.getWorstForObject(key, timestampMs);

    return {
      utc: timestampMs,
      lat: geo.lat,
      lon: geo.lon,
      alt: geo.alt,
      miss_distance_km: worst ? worst.missDistanceKm : null,
      tca: worst ? worst.tca : null,
      probability_of_collision: worst ? worst.probabilityOfCollision : null
    };
  }
}

export { HARD_BODY_RADIUS_KM, POSITION_SIGMA_KM, WINDOW_MS };
