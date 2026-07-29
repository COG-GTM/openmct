# Test Report — PR #14: UDL Federation example plugin

Tested end-to-end in the browser against the local webpack dev server (`npm start`, http://localhost:8080) on branch `devin/1785344499-udl-federation-plugin` (HEAD 62df42f). Recording: `/home/ubuntu/screencasts/rec-07188730-0284-41ec-8f54-9a65314a7790/rec-07188730-0284-41ec-8f54-9a65314a7790-edited.mp4`.

## Results

| # | Test | Result |
|---|------|--------|
| 1 | Tree shows UDL Federation Node with 3 satellites + Conjunction Assessments | ✅ Passed |
| 2 | Satellite ephemeris plot renders and streams live in Real-Time mode | ✅ Passed |
| 3 | Conjunction Assessments plots Pc; telemetry table highlights limit rows (red ≥1e-4, yellow ≥1e-5) | ✅ Passed |
| 4 | No console errors from the plugin | ✅ Passed |
| 5 | Regression: Sine Wave Generator create + plot still works | ✅ Passed |

## Evidence

### 1. Root node and children
Tree and Grid View show exactly: GPS III SV05 (NAVSTAR 82), WGS-11, SBIRS GEO-6 (USA 336) (all UDL Ephemeris) and Conjunction Assessments (UDL Conjunction Assessments).

| Tree (zoom) | Grid View |
|---|---|
| ![Tree](https://app.devin.ai/attachments/0cd84fa7-e148-40b7-b220-b34382e86d90/ss_zoom_c74004fe.png) | ![Grid](https://app.devin.ai/attachments/51f780b0-67f9-4fec-bb01-b40d6feb123b/ss_93d8323d.png) |

### 2. Live ephemeris plot (GPS III SV05)
Altitude plots ~20181.8–20182 km (matches simulated 20180 km ±2 wobble); Latitude/Longitude/Velocity available as series options. After switching the time conductor to Real-Time (Local Clock), the plot right edge advanced each second (axis extended 17:04 → 17:06 during observation, "Last update" ticking).

| Fixed timespan plot | Real-Time mode streaming (axis extended, new points at right edge) |
|---|---|
| ![Fixed](https://app.devin.ai/attachments/6ae57317-142b-4bac-aa29-6539780e4368/ss_217a2175.png) | ![Realtime](https://app.devin.ai/attachments/5a1bc27c-92ea-4e5f-9821-f17fd1a81550/ss_3eb63459.png) |

### 3. Conjunction Assessments — Pc plot and limit highlighting
Pc plot shows baseline values <2e-5 with periodic spikes up to ~7e-4. Telemetry Table view highlights Probability of Collision cells: **red** for Pc ≥ 1e-4 (e.g. 0.000679, 0.000694, 0.0007), **yellow** for 1e-5 ≤ Pc < 1e-4 (e.g. 0.0000107–0.0000183), no highlight below 1e-5 (e.g. 0.00000549). Rows carry Miss Distance (km) and Secondary Object (debris/RB names).

| Pc plot | Table limit highlighting (zoom) |
|---|---|
| ![Pc plot](https://app.devin.ai/attachments/8aa3239f-53be-4423-aacd-d7a1ff2922fd/ss_14ad1a8d.png) | ![Table limits](https://app.devin.ai/attachments/9cd36722-c472-423d-9906-93eef5f53518/ss_zoom_fe05ab94.png) |

### 4. Console
After a fresh page reload and interacting with all UDL objects, the console contained no errors. Only pre-existing noise: a Vue `defineExpose()` compiler-hint warning from `AppLayout/StatusIndicators` (present on master, unrelated to plugin) and webpack-dev-server/HMR info logs.

### 5. Regression — Sine Wave Generator
Created via Create > Sine Wave Generator into My Items; plot renders live sine data in Real-Time mode.

![Sine regression](https://app.devin.ai/attachments/d5d489cf-400b-4a26-a8e9-6a09b68535b9/ss_f6064aaa.png)

## Notes
- The limit thresholds observed in the table match `ConjunctionLimitProvider.js` (PC_CRITICAL=1e-4 red, PC_WARNING=1e-5 yellow).
- No issues found.
