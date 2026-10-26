# Reference cases

`reference_cases.json` holds trajectories computed by **established external solvers** so the
engine can be checked against them. It ships empty on purpose: every value must come from a real
run of a named solver, never from memory or estimation. The test in `test/reference.test.ts` skips
while `cases` is empty.

## How to add a case

1. Run a load through [JBM Ballistics](https://www.jbmballistics.com/cgi-bin/jbmtraj-5.1.cgi) or
   the Hornady 4DOF calculator. Use **point-mass / standard G1 or G7** settings where offered.
2. Copy the inputs exactly as entered and the output table at the ranges you care about.
3. Append an object to `cases`:

```json
{
  "id": "jbm-6.5cm-g7-example",
  "source": "JBM Ballistics Trajectory 5.1",
  "sourceUrl": "https://www.jbmballistics.com/cgi-bin/jbmtraj-5.1.cgi",
  "retrievedAt": "2026-11-01",
  "notes": "Spin drift and Coriolis off in JBM.",
  "input": {
    "dragFunction": "G7",
    "bc": 0.0,
    "bulletWeightGr": 0,
    "bulletDiameterIn": 0.0,
    "bulletLengthIn": 0.0,
    "muzzleVelocityFps": 0,
    "sightHeightIn": 0.0,
    "zeroRangeYd": 100,
    "twistIn": 0,
    "twistDirection": "right",
    "temperatureF": 59,
    "pressureInHg": 29.92,
    "pressureType": "station",
    "altitudeFt": 0,
    "humidityPercent": 0,
    "windSpeedMph": 0,
    "windClock": 3,
    "inclineDeg": 0,
    "spinDrift": false
  },
  "expected": [{ "rangeYd": 1000, "dropIn": 0.0, "windageIn": 0.0, "velocityFps": 0 }],
  "tolerance": { "elevationMil": 0.1, "windageMil": 0.1, "velocityPercent": 1 }
}
```

(The zeros above are placeholders showing the shape — replace every one.)

## Field reference

| Field          | Meaning                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `dropIn`       | Trajectory relative to line of sight, inches, **negative below** (JBM's "Drop" sign).                          |
| `windageIn`    | Lateral impact, inches, **negative = left**.                                                                   |
| `elevationMil` | Optional: the solver's elevation correction directly, MIL, positive up. Used instead of `dropIn` when present. |
| `pressureType` | `station` (absolute, at the firing point) or `baro` (sea-level corrected; needs `altitudeFt`).                 |
| `tolerance`    | Defaults: 0.1 MIL elevation, 0.1 MIL windage, 1% velocity. Target for G7 match bullets to 1,000 yd.            |

Optional `input` fields (`bulletLengthIn`, `twistIn`, wind, incline) may be omitted. Leave
`spinDrift` false unless the reference solver had spin drift enabled.
