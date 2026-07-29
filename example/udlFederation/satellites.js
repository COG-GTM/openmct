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
 * Simulated constellation for the UDL federation node. Orbital parameters are
 * simplified two-body circular orbits, sufficient for a representative
 * ephemeris stream (UDL `elset`/`statevector` analog).
 */
export const SATELLITES = [
  {
    key: 'gps-iii-sv05',
    name: 'GPS III SV05 (NAVSTAR 82)',
    noradId: 48859,
    altitudeKm: 20180,
    inclinationDeg: 55,
    raanDeg: 40,
    phaseDeg: 0
  },
  {
    key: 'wgs-11',
    name: 'WGS-11',
    noradId: 54800,
    altitudeKm: 35786,
    inclinationDeg: 0.02,
    raanDeg: 0,
    phaseDeg: 130
  },
  {
    key: 'sbirs-geo-6',
    name: 'SBIRS GEO-6 (USA 336)',
    noradId: 53355,
    altitudeKm: 35786,
    inclinationDeg: 1.4,
    raanDeg: 0,
    phaseDeg: 245
  }
];

export const EARTH_RADIUS_KM = 6371;
export const MU_EARTH = 398600.4418; // km^3/s^2
