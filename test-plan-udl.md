# Test Plan: UDL Federation example plugin (PR #14)

App: http://localhost:8080 (webpack dev server, branch devin/1785344499-udl-federation-plugin). Record the run.

## Test 1: It should show UDL Federation Node tree with 3 satellites + Conjunction Assessments
- Expand "UDL Federation Node" root in left tree.
- PASS: children exactly: "GPS III SV05 (NAVSTAR 82)", "WGS-11", "SBIRS GEO-6 (USA 336)", "Conjunction Assessments".

## Test 2: It should render live-updating ephemeris plot for a satellite
- Click GPS III SV05. Expect a plot view with series (Altitude ~20180 km ±2, plus lat/lon/velocity).
- Switch time conductor to Real-Time (local clock) mode; wait ~10s.
- PASS: plot renders data (non-empty line), new points appear at right edge over time (compare two screenshots ~10s apart).

## Test 3: It should plot Pc values and highlight limit rows in telemetry table
- Click Conjunction Assessments: plot shows Pc values (mostly <2e-5, occasional spikes ≥2e-4).
- Switch view to "Telemetry Table" via view switcher (top right).
- PASS: table shows rows with Timestamp, Probability of Collision, Miss Distance, Secondary Object columns; rows with pc ≥1e-4 highlighted red (is-limit--red), 1e-5≤pc<1e-4 yellow. Widen historical window if needed to capture a spike (pc spikes when |sin(slot/7)|>0.92, slot=5s buckets, so spikes occur in bursts every ~110s — a 30+ min historical window guarantees several).

## Test 4: It should produce no console errors from the plugin
- Check browser console after above interactions.
- PASS: no uncaught errors/warnings referencing udlFederation files.

## Test 5 (Regression): existing objects still work
- Create > Sine Wave Generator into My Items; open it.
- PASS: object created and plot renders.
