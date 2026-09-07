# Flight Test Telemetry example plugin

An example plugin for aircraft flight-test / mission-systems integration
telemetry. It adds a **Flight Test Telemetry** root containing a fictional
test article (**Test Article TA-01**) backed by a deterministic simulated
sortie, so plots look like a real test flight and every value can be
reproduced for any point in time.

The plugin is **not** installed by default. Enable it from `index.html` (or
your own entry point) with:

```js
openmct.install(openmct.plugins.example.FlightTest());
```

To see exceedances as faults, also install Fault Management and create a
_Fault Management_ object in the tree:

```js
openmct.install(openmct.plugins.FaultManagement());
```

## Object tree

```
Flight Test Telemetry
└── Test Article TA-01
    ├── PCM Parameters          altitude, airspeed, AOA, pitch/roll/yaw, Nz,
    │                           N1, N2, EGT, fuel flow, fuel quantity
    ├── MIL-STD-1553 Bus Health Bus A / Bus B message rate, word errors,
    │                           no-response count, status (NOMINAL/DEGRADED/FAILED)
    ├── TSPI                    latitude, longitude, altitude, ground speed
    └── Test Card Events        test-point marks and bus events
```

## Simulated sortie

Each 24-minute sortie is aligned to the Unix epoch and repeats, so historical
requests and realtime subscriptions read from the same profile:

| Minutes | Phase                | Notes                                                    |
| ------- | -------------------- | -------------------------------------------------------- |
| 0–1     | Takeoff              |                                                          |
| 1–6     | Climb                | Climb schedule 300 kt to FL250                           |
| 6–12    | Level cruise         | Heading change, acceleration to 420 kt                   |
| 12–14   | Wind-up turn (TP-04) | Nz and AOA pass the warning and then the critical limits |
| 14–17   | Recovery             | Bus B degrades, fails, fails over and is restored        |
| 17–22   | Descent              |                                                          |
| 22–24   | Approach and landing |                                                          |

## Limits and faults

| Parameter                | Warning | Critical |
| ------------------------ | ------- | -------- |
| Normal load factor (Nz)  | ≥ 5.5 g | ≥ 6.5 g  |
| Angle of attack          | ≥ 20°   | ≥ 25°    |
| Exhaust gas temperature  | ≥ 900°C | ≥ 950°C  |
| MIL-STD-1553 word errors | ≥ 5/s   | ≥ 20/s   |

Warnings highlight yellow and criticals red in tables; plots draw limit lines.
Critical exceedances and DEGRADED/FAILED bus status are published to Fault
Management (WARNING for a degraded bus, CRITICAL otherwise), latch until the
condition clears and the fault is acknowledged, and can be shelved.

## Modules

| Module                          | Purpose                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `plugin.js`                     | Registers types, root, object/telemetry/limit providers and the fault source |
| `flightProfile.js`              | Deterministic keyframed sortie: `sampleFlight(utc)`, `eventsBetween()`       |
| `parameters.js`                 | Parameter catalog, units, enumerations, limits and telemetry metadata        |
| `FlightTestObjectProvider.js`   | Static domain-object tree                                                    |
| `FlightTestTelemetryProvider.js`| Historical `request()` (size, `latest`, datum cap) and realtime `subscribe()`|
| `FlightTestLimitProvider.js`    | Limit evaluator (table highlighting) and limit lines (plots)                 |
| `FlightTestFaultProvider.js`    | Exceedance monitor publishing to the Fault Management API                    |
| `Chapter10Adapter.js`           | IRIG 106 Chapter 10 packet header + MIL-STD-1553 Format 1 parser             |

## IRIG 106 Chapter 10 adapter

`Chapter10Adapter` parses Chapter 10 packet headers (sync `0xEB25`, channel
ID, packet/data length, data type version, sequence number, packet flags, data
type, 48-bit relative time counter, header checksum) from an `ArrayBuffer`,
`DataView` or typed array, maps channel IDs to this plugin's telemetry keys,
and parses MIL-STD-1553 Format 1 (data type `0x19`) intra-packet headers far
enough to extract bus ID, error flags and word count. It is not a full
PCM/1553 decoder. Malformed input (bad sync, truncated buffers, inconsistent
lengths) is rejected with a `Chapter10Error` that carries the byte offset.

```js
import Chapter10Adapter from './Chapter10Adapter.js';

const adapter = new Chapter10Adapter();
adapter.parseStream(arrayBuffer).forEach((packet) => {
  // packet.header, packet.keys (mapped telemetry keys),
  // packet.busHealth (per-bus error summary, 1553 Format 1 only)
});
```
