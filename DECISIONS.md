# Decisions

One line each: **decision** — reason — how to reverse.

## Phase 0

- **pnpm 12.15.0, pinned via `packageManager`** — brief mandates pnpm; Corepack couldn't write to `C:\Program Files` without admin, so pnpm was installed with `npm i -g pnpm` — change the `packageManager` field to move versions.
- **TypeScript pinned to `~6.0.3`, not 7.x** — `typescript-eslint` 8.72 supports `<6.1.0`; TS 7 (native compiler) would break linting — bump once typescript-eslint supports 7.
- **Node ≥ 22.12 (`.nvmrc` = 24)** — Vitest 5 requires `^22.12 || ^24 || >=26`; Vercel supports 24 — edit `engines` + `.nvmrc`.
- **`@bf/engine` exports TypeScript source (`./src/index.ts`), no build step** — Next.js (`transpilePackages`) and Expo/Metro both consume TS directly; avoids a dist/ that can drift — add a `tsup` build and point `exports` at `dist/` if a consumer needs JS.
- **Engine tsconfig has `lib: ["ES2022"]`, `types: []`** — makes DOM and Node globals a type error inside the engine, enforcing purity for React Native — widen `lib` in `packages/engine/tsconfig.json`.
- **ESLint `strict` + `stylistic` presets without type-aware linting** — fast, no project-service setup for config files; engine code is pure math so type-aware rules add little — switch to `strictTypeChecked` with `parserOptions.projectService`.
- **Engine lint bans `any`, non-null assertions, DOM/Node globals, and React/Node imports** — brief §0.8 — relax in `eslint.config.js`.
- **Per-package Vitest configs; engine runs with coverage thresholds (90% lines/functions/statements, 85% branches)** — brief §5.8 requires ≥ 90% line coverage; the gate fails if it drops — edit `packages/engine/vitest.config.ts`.
- **Strict compiler extras: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`** — catches drag-table index and optional-input bugs at compile time — remove from `tsconfig.base.json`.
- **LF line endings enforced via `.gitattributes` + Prettier** — repo is developed on Windows but deployed on Linux — change `eol` in `.gitattributes`.
- **Kept pnpm's auto-added `minimumReleaseAgeExclude` for `typescript-eslint@8.72.1`** — pnpm 12 blocks packages newer than its release-age window; these are the official typescript-eslint packages — delete the list from `pnpm-workspace.yaml` and downgrade typescript-eslint to an older release.
- **GitHub Actions CI runs the phase gate + `format:check`** — Chad reviews in batches; CI makes red builds visible — delete `.github/workflows/ci.yml` (no remote configured yet, so it is inert until pushed to GitHub).

## Phase 1 — Engine

### API shape

- **Engine API takes SI numbers with unit-suffixed field names (`muzzleVelocityMps`, `sightHeightM`) instead of branded unit types** — plain numbers keep the API easy for the web form and React Native; suffixes make the unit obvious at every call site — introduce branded types in `units.ts` if unit mix-ups appear.
- **Solver returns SI + radians; display units/clicks live in `dope.ts`** — one physics output, many presentations (calculator, DOPE card, range mode) — n/a.
- **`ranges` is an explicit list of LOS distances (helper `rangeSteps`)** — the same solver serves full tables, range mode (one distance) and truing — n/a.
- **Hand-rolled validation in the engine, not Zod** — engine must have zero runtime deps; the web app uses Zod for forms and can map engine issue `code`s — swap in Zod only if the engine is allowed a dependency.
- **Validation messages are US units first** (e.g. "Sight height of 25 in looks wrong — did you mean 2.5 in?") — pilot audience is US shooters; `code` + `path` let the UI localize — edit messages in `validation.ts`.
- **`solve()` throws `BallisticsInputError` on any error-severity issue; warnings are returned, not thrown** — garbage in should never produce a confident-looking table — call `validateSolveInput` first to show issues inline.

### Atmosphere

- **Saturation vapor pressure: Arden Buck (1996) over water, used for all temperatures** — accurate to ~0.05% for −40…50 °C; below 0 °C the "over ice" form differs slightly but humidity's effect on density is tiny there — add Buck-over-ice for T < 0 °C.
- **R = 287.05 J/(kg·K), γ = 1.4; speed of sound from dry air** — per brief; humidity's effect on c is < 0.3% — use a humid-air γ/R if reference cases demand it.
- **Baro → station pressure via the ISA barometric formula (lapse 6.5 K/km, exponent 5.2559)** — matches how altimeter-setting pressure is defined — n/a.
- **Army Standard Metro preset = 59 °F, 750 mmHg, 78% RH** — documented standard; density check against 0.0751265 lb/ft³ passes within 0.1% — n/a.
- **Atmosphere is constant along the trajectory** (no density change with bullet height) — < 0.1% effect for flat-fire ranges — add per-step altitude if steep long shots need it.

### Drag & solver

- **BC drag form `a = (π/8)·ρ·v²·Cd_G(M)/BC` with BC = m/(i·d²) in kg/m²; no BC standard-atmosphere correction** — BC as defined is atmosphere-independent; the actual density ρ carries all atmospheric effects — n/a.
- **`DragModel.coefficient(mach, airspeed)` returns Cd/BC (m²/kg)** — same interface fits standard-function BCs, stepped BCs, BC scaling (truing) and future custom drag curves (Cd·d²/m) — n/a.
- **Stepped (Sierra-style) BC bands are selected by airspeed; below the lowest threshold the lowest band applies** — matches how Sierra publishes them — n/a.
- **Integration in the line-of-sight frame: x along the LOS; gravity, wind and Earth rotation are rotated by the incline** — this is true incline integration (not the cosine rule); reported range is slant (rangefinder) range — n/a. The cosine rule is available as `solveRiflemansRule` for the advanced comparison panel.
- **Wind direction is where the wind comes FROM, clockwise from the target (12 o'clock = headwind, 3 o'clock = from the right)** — the shooter's clock convention — n/a.
- **Mach uses airspeed (|v − wind|), not ground speed** — drag physically depends on airspeed; difference is < 1% in normal winds — n/a.
- **Defaults: dt = 0.5 ms, velocity floor 50 m/s, time cap 15 s** — dt halving changes 1,000 yd drop by far less than 0.05% (tested) — override via `options`.
- **Output rows are sampled by cubic Hermite interpolation between RK4 steps** — exact for the vacuum parabola, ~10⁻¹² m error with drag, and halved solve time vs. extra partial RK4 steps — n/a.
- **Integrator hot loop uses scalar math with a scratch object (no Vec3 allocation)** — 0–1,500 yd at 1 yd resolution with wind + Coriolis dropped from 13.5 ms to 5.9 ms on the dev PC — n/a.
- **Coriolis components are reported by differencing against a second, Coriolis-free integration** — exact attribution, only costs time when Coriolis is on — n/a.

### Zero

- **Zero is solved level, in still air, without Coriolis, at the zero atmosphere and zero MV (both default to current)** — how rifles are actually zeroed; lets "zeroed cold, shooting hot" and "zeroed unsuppressed" work correctly — n/a.
- **No lateral zero: spin drift and Coriolis accrue from the muzzle** — simplest honest model; at 100 yd spin drift is < 0.1 in — add a windage zero if users zero out drift.
- **Zero tolerance 1e-6 m (brief requires < 0.001 in = 2.5e-5 m); secant from a vacuum guess with bisection fallback** — converges in 3–4 integrations — n/a.

### Stability, spin drift, aerodynamic jump

- **Miller twist rule with Miller's velocity and temperature/pressure corrections; station pressure used** — standard practice — n/a.
- **Spin drift: Litz `1.25·(Sg + 1.2)·TOF^1.83` in, applied as a lateral offset after integration, on by default when bullet length and twist are known; otherwise off with a warning** — per brief — set `options.spinDrift: false`.
- **Stability warnings at Sg < 1.0 (unstable) and Sg < 1.4 (marginal)** — Litz's recommended minimum — change `MARGINAL_STABILITY`.
- **Aerodynamic jump implemented with the Litz approximation `(0.01·Sg − 0.0024·L + 0.032)` MOA/mph, OFF by default** — the coefficients and the sign convention (RH twist, wind from the right → impact up) were written from memory of Litz's text and are listed in NEEDS_CHAD.md for verification — leave off until verified.

### Truing

- **Truing uses the Illinois (regula falsi) method inside fixed bounds: MV ±25% of chrono, BC scale 0.6–1.4** — robust and fast; no result outside the bounds is returned as "converged" — change `MV_TRUING_BOUNDS` / `BC_TRUING_BOUNDS`.
- **"Distance too short" warning when a 1% MV change (or 2.5% BC change) moves impact by less than one 0.1 MIL click; BC truing also warns when the bullet is still above Mach 1.5** — a physical sensitivity test instead of a fixed yardage — tune the constants in `truing.ts`.
- **MV truing shifts an explicit zero MV by the same delta** — same ammo, same chrono error — n/a.
- **Truing returns the observation conditions but no timestamp** — the engine is pure (no clock); the app stamps the date when saving — n/a.

### Suppressor, DOPE, stats

- **`applySuppressor(input, adjustment, 'attach' | 'detach')`: changes shot MV and adds the POI shift but keeps the zero angle from the zero configuration** — matches reality (the zero was set in one configuration) — n/a.
- **Click rounding `down` = toward zero (never dial more than the solution)**; `nearest` rounds half away from zero symmetrically — n/a.
- **DOPE wind holds are wind-only (spin drift reported in a separate "drift" column), for full-value wind from 3 o'clock** — the shooter mirrors for 9 o'clock; keeping drift separate avoids an asymmetric wind column — n/a.
- **Student-t quantiles computed numerically (incomplete beta + bisection) instead of a lookup table** — no transcribed constants; tested against the closed forms for df = 1 and 2 — n/a.
- **MAD outlier filter falls back to 1.2533 × mean absolute deviation when MAD = 0** — otherwise one outlier among identical values could never be excluded — n/a.

### Tooling

- **Separate `tsconfig.test.json` (adds Node types) so `src` stays free of DOM/Node globals** — tests need `performance`; the engine must not — n/a.
- **The performance test runs in a separate, non-coverage Vitest pass** — coverage instrumentation slows the solver ~3–4× and would make the timing assertion meaningless — n/a.
- **Performance budget asserted at < 10 ms on desktop (5× margin under the 50 ms phone target)** — measured 5.9 ms — loosen if CI hardware is slower.
