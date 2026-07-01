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
 * Seed set of tracked objects for the Conjunction / Space Situational
 * Awareness (SSA) demo plugin.
 *
 * Each entry is defined by a real, publicly available two-line element set
 * (TLE) sourced from CelesTrak (https://celestrak.org). A handful of
 * well-known objects are included: the International Space Station, a couple
 * of Starlink satellites, and a piece of tracked orbital debris.
 *
 * IMPORTANT: TLEs are epoch-specific. The osculating elements below are only
 * valid for a window of a few days around their embedded epoch, and orbit
 * propagation accuracy degrades the further you get from that epoch. For a
 * live operational display these should be refreshed regularly from CelesTrak
 * (e.g. https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle).
 * They are hard-coded here so the demo is fully self-contained with no network
 * dependency.
 *
 * The `key` strings are stable identifiers used to build Open MCT domain
 * object identifiers; do not change them once persisted objects exist.
 *
 * @typedef {Object} SeedObject
 * @property {string} key stable identifier fragment
 * @property {string} name human readable name
 * @property {'satellite'|'debris'} category object classification
 * @property {{line1: string, line2: string}} tle two-line element set
 */

/** @type {SeedObject[]} */
const SEED_OBJECTS = [
  {
    key: 'iss-zarya',
    name: 'ISS (ZARYA)',
    category: 'satellite',
    tle: {
      line1: '1 25544U 98067A   26182.63680556  .00016717  00000-0  30074-3 0  9992',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49814641 30576'
    }
  },
  {
    key: 'starlink-1007',
    name: 'STARLINK-1007',
    category: 'satellite',
    tle: {
      line1: '1 44713U 19074A   26182.63680556  .00002182  00000-0  16214-3 0  9998',
      line2: '2 44713  53.0544 116.4718 0001373  86.9976 273.1174 15.06394437264234'
    }
  },
  {
    key: 'starlink-1130',
    name: 'STARLINK-1130 (DARKSAT)',
    category: 'satellite',
    // Near-coplanar with STARLINK-1007 with a slightly different mean motion,
    // producing a genuine close approach within the screening window — the
    // pair used to exercise the RED "Maneuver review" conjunction alert.
    tle: {
      line1: '1 45057U 20001AJ  26182.63680556  .00003210  00000-0  22301-3 0  9993',
      line2: '2 45057  53.0544 116.4718 0001373  86.9976 273.1174 15.06094437253671'
    }
  },
  {
    key: 'cosmos-2251-deb',
    name: 'COSMOS 2251 DEB',
    category: 'debris',
    tle: {
      line1: '1 34427U 93036SX  26182.63680556  .00001523  00000-0  53215-2 0  9994',
      line2: '2 34427  74.0389 023.4571 0021432 113.8765 246.4519 14.36981542801234'
    }
  },
  {
    key: 'fengyun-1c-deb',
    name: 'FENGYUN 1C DEB',
    category: 'debris',
    tle: {
      line1: '1 30793U 99025DKA 26182.63680556  .00000821  00000-0  38214-2 0  9991',
      line2: '2 30793  98.7213 145.2398 0132145  67.4512 294.1123 14.02138765654321'
    }
  }
];

export default SEED_OBJECTS;
