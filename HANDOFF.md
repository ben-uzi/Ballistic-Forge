# Handoff

_Running draft. Written in full at the end of Phase 8 (see `docs/BUILD_BRIEF.md` §0.9)._

## Status

- Phase 0 (scaffold) — complete.
- Phase 1 (engine) — complete. 143 tests; 99.8% line / 92.9% branch coverage. See `PLAN.md`.

## Engine: known physics limitations (as of Phase 1)

- **Point-mass (3DOF) model** with standard G1/G7 drag functions. No 6DOF, no custom drag curves yet
  (the `DragModel` interface is ready for them).
- **Drag tables were transcribed, not downloaded** — verify against source (NEEDS_CHAD 4a).
- **Not yet validated against an external solver.** The reference-case harness exists and skips
  until `reference_cases.json` is filled (NEEDS_CHAD 4). Until then, correctness rests on the
  analytical/physical tests (vacuum parabola, convergence, symmetry, round-trips).
- **Constant atmosphere along the flight path** (no density change with bullet height).
- **Single constant wind zone**; no vertical wind.
- **Spin drift is the Litz empirical formula**, applied as a lateral offset after integration; no
  lateral zero (drift accrues from the muzzle).
- **Aerodynamic jump** is an empirical approximation, off by default and unverified (NEEDS_CHAD 4b).
- **Stability uses the Miller rule**, which is less accurate for very long, plastic-tipped or
  monolithic bullets.
- **No scope cant** input.
- **Saturation vapor pressure uses the over-water formula** at all temperatures (tiny error below 0 °C).

## Engine quick reference

```ts
import { solve, standardDragModel, rangeSteps, buildDope, CLICK_VALUES } from '@bf/engine';
```

All inputs are SI (`muzzleVelocityMps`, `sightHeightM`, `temperatureK` …); convert with the helpers
in `units.ts`. `solve()` throws `BallisticsInputError` for invalid input; call
`validateSolveInput()` first to show issues inline.
