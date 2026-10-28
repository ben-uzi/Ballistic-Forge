# Ballistic Forge — Pilot Build Plan

Source spec: [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md) (v3). Section numbers below (§) refer to it.

**How to read this:** each phase is a checklist. Boxes get ticked as work lands. A phase is only
closed when its **Gate** passes (`pnpm typecheck && pnpm lint && pnpm test` green) and it is committed
as `phase-N: <summary>`. Decisions go in `DECISIONS.md`, blockers in `NEEDS_CHAD.md`.

**Priority rule:** the engine is the product. If time runs short, cut UI scope — never engine tests.

| Phase | Scope                                               | Depends on | Status |
| ----- | --------------------------------------------------- | ---------- | ------ |
| 0     | Monorepo scaffold, tooling, tracking docs           | —          | ☑      |
| 1     | `@bf/engine` — physics, test-first                  | 0          | ☑      |
| 2     | Web shell + calculator (guest mode, no env vars)    | 1          | ☑      |
| 3     | Supabase schema, RLS, seed pipeline                 | 0          | ☑      |
| 4     | Profiles, DOPE cards (PDF), Range mode              | 2, 3       | ☑      |
| 5     | The Can — suppressor toggle + compatibility checker | 4          | ☑      |
| 6     | The Field — session logging + aggregation           | 3, 4       | ☐      |
| 7     | Library, auth polish, entitlements stub, onboarding | 3–6        | ☐      |
| 8     | Hardening, E2E, a11y, Lighthouse, handoff           | all        | ☐      |

---

## Phase 0 — Scaffold & tooling

- [x] pnpm workspace: root `package.json`, `pnpm-workspace.yaml` (`packages/*`, `apps/*`)
- [x] Root scripts: `typecheck`, `lint`, `test`, `build`, `dev` fanned out across workspaces (+ `gate`, `format`)
- [x] Shared `tsconfig.base.json` — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [x] ESLint (flat config) + Prettier; engine bans `any`, DOM/Node globals, React/Node imports (verified)
- [x] Vitest with v8 coverage (per-package config; engine thresholds 90% lines)
- [x] `packages/engine` skeleton (zero runtime deps, ESM, exports TS source for web + React Native)
- [x] `apps/web` placeholder (filled in Phase 2)
- [x] `supabase/`, `scripts/` directories
- [x] `.gitignore`, `.gitattributes`, `.nvmrc` / `engines` field, `.editorconfig`
- [x] Create `DECISIONS.md`, `NEEDS_CHAD.md` (seed with known blockers below), `HANDOFF.md` stub
- [x] GitHub Actions CI running the gate on push (inert until a GitHub remote exists)
- [x] **Gate** → `phase-0: scaffold monorepo`

## Phase 1 — The Engine (`@bf/engine`) §5

Pure functions only — no React, DOM, or network. All internal math in SI.

### 1.1 Units (`units.ts`) §5.1

- [x] Length: yd / m / ft / in / cm (+ mm)
- [x] Speed: fps / mps / mph / kph
- [x] Mass: gr / g / kg (+ lb)
- [x] Temperature: °F / °C / K
- [x] Pressure: inHg / hPa / mbar / psi / Pa (+ mmHg)
- [x] Energy: ft-lbf / J
- [x] Angles: true MOA (1/60°), IPHY (shooter's MOA, separate), MIL, radians, degrees
- [x] BC conversion constant 1 lb/in² = 703.0696 kg/m²
- [x] ~~Branded/nominal types~~ → unit-suffixed SI field names instead (see DECISIONS)
- [x] Tests: round-trips for every unit pair

### 1.2 Atmosphere (`atmosphere.ts`) §5.2

- [x] Inputs: temp, pressure **with explicit `station` | `baro` type**, altitude, RH
- [x] Baro → station pressure conversion using altitude
- [x] Humid air density (dry-air + vapor partial pressures); saturation vapor pressure via Arden Buck (log in DECISIONS)
- [x] Speed of sound (γ = 1.4, R = 287.05 J/kg·K)
- [x] Density altitude
- [x] Presets: ICAO standard; Army Standard Metro (documented)
- [x] Tests: standard conditions → standard density within 0.1% (ICAO and Army Standard Metro)

### 1.3 Drag (`dragTables.ts`) §5.3

- [x] Standard G1 and G7 Mach→Cd tables with source comment (verification → NEEDS_CHAD 4a)
- [x] Linear interpolation, clamped at ends
- [x] `DragModel` interface (so a CDM can plug in later)
- [x] Single BC and **velocity-banded BCs** (Sierra-style stepped G1)
- [x] Deceleration `a = (π/8)·ρ·v_rel²·Cd(M)/BC` opposite air-relative velocity
- [x] Tests: interpolation exact at table points, clamping, band selection

### 1.4 Solver (`solver.ts`) §5.4

- [x] 3D state (downrange, vertical, lateral) + velocity, integrated in the line-of-sight frame
- [x] Fixed-step RK4, default dt = 0.5 ms, configurable
- [x] Wind: speed + direction (clock or radians) → vector; air-relative velocity = v − wind; head/cross components
- [x] Interface allows multi-zone wind later (pilot: single constant zone)
- [x] True incline: gravity vector rotated by inclination angle; cosine-rule comparison (`solveRiflemansRule`)
- [x] Coriolis toggle (`coriolis.ts`): latitude + azimuth, Ω = 7.292115e-5 rad/s, as acceleration
- [x] Spin drift (`spinDrift.ts`): Miller Sg with temp/pressure correction; Litz drift vs TOF; disabled with reason if bullet length unknown
- [x] Aerodynamic jump: Litz approximation behind toggle, default off (verification → NEEDS_CHAD 4b)
- [x] Stop conditions: requested max range, velocity floor, time cap (+ not-advancing guard)
- [x] Output rows: range, path, elevation/windage angles, velocity, Mach, energy, TOF, spin drift, Coriolis components, regime flag (≤ 1.2 transonic, ≤ 1.0 subsonic); clicks via `dope.ts`
- [x] Energy computed both ways (gr·fps²/450,240 and SI) and asserted equal within 0.1%

### 1.5 Zeroing (`zero.ts`) §5.5

- [x] Inputs: zero range, sight height, **zero atmosphere** (separate from current), zero offset, zero MV
- [x] Launch-angle solve (secant from vacuum guess, bisection fallback), tolerance 1e-6 m (< 0.001 in)
- [x] Outputs relative to LOS under current conditions

### 1.6 Corrections & DOPE (`dope.ts`) §5.6

- [x] Turret click values: 0.1 MIL, 0.25 MOA, 1/8 MOA, custom; separate elev/wind
- [x] Rounding mode: nearest / down
- [x] Table generation helper (`rangeSteps`) + `buildDope` with wind-hold columns

### 1.7 Truing (`truing.ts`) §5.7

- [x] MV truing from observed elevation at distance D (Illinois method)
- [x] BC scale-factor truing at long range; warnings for too-short distance / still-supersonic / out-of-bounds
- [x] Results returned as new values with conditions; original kept (app adds the date)

### 1.8 Suppressor & stats (`suppressor.ts`, `stats.ts`, `load.ts`)

- [x] Apply MV delta + POI offset to a profile (pure, source-labelled, attach/detach)
- [x] mean, SD, ES, median, MAD (scaled), t-distribution 95% CI, outlier filter
- [x] Powder temperature sensitivity (`temperatureAdjustedMuzzleVelocity`)

### 1.9 Validation

- [x] Hand-rolled, zero-dep validation with human messages ("Sight height of 25 in looks wrong — did you mean 2.5 in?"), plus BC plausibility check

### 1.10 Required tests §5.8

- [x] Vacuum (Cd = 0) matches analytical parabola within 1e-6 relative
- [x] Zero: path crosses LOS at zero range within tolerance
- [x] Velocity strictly decreasing (still air, flat fire)
- [x] Step-size convergence: halving dt changes 1,000 yd drop < 0.05%
- [x] Unit round-trips
- [x] Standard atmosphere density within 0.1%
- [x] Wind symmetry: 3 o'clock vs 9 o'clock mirror image
- [x] Incline: uphill ≈ downhill, both < flat
- [x] Truing round-trip recovers MV within 1 fps
- [x] `test/fixtures/reference_cases.json` with documented schema, **empty**; harness skips when empty; target 0.1 MIL to 1,000 yd
- [x] Performance: 0–1,500 yd at 1 yd steps with wind + Coriolis = 5.9 ms on desktop (asserted < 10 ms)
- [x] Coverage ≥ 90% lines (99.8% lines, 92.9% branches)
- [x] **Gate** → `phase-1: engine`

## Phase 2 — Web shell + calculator §4, §6

- [x] Next.js 16.4.3 (App Router, TS strict) in `apps/web`, consuming `@bf/engine` via workspace
- [x] Tailwind v4 + hand-built shadcn/Radix components; brand tokens: gunmetal scale (950→600 from `#1C1C2E`), amber `#C8860A`, muted status colors
- [x] Fonts: Inter (UI), Source Code Pro with tabular numerals (data, via the `.num` class)
- [x] Placeholder SVG logo (scope reticle + wordmark) and generated PWA icons — logged in NEEDS_CHAD
- [x] App shell: mobile-first nav, ≥ 44 px tap targets, dark default; unbuilt sections shown as disabled
- [x] Persistence abstraction: `LocalStore` (guest, localStorage) vs `SupabaseStore` — `getStore()` selects
- [x] Feature-flag + entitlement plumbing stubs (filled in Phase 3/7)
- [x] `/` landing: tagline, three pillars, "Join the beta" (server log in demo mode); no fake stats
- [x] `/calc`:
  - [x] Collapsible groups: Bullet/Load, Rifle, Conditions
  - [x] Explicit station vs baro pressure selector with help text
  - [x] Opt-in "use my location" (latitude only, rounded to 0.1°, never stored)
  - [x] Sticky output table, configurable range start/end/step, transonic rows flagged
  - [x] Charts (Recharts): Drop, Velocity, Energy, Drift — palette validated for the dark surface
  - [x] Compare mode: up to 3 loads overlaid
  - [x] Unverified-data badge wherever library data is unverified
  - [x] ~~Solver in a Web Worker~~ → not needed; main-thread solve measures ~6 ms (see DECISIONS)
  - [x] Guest-mode prompt
- [x] Disclaimer on every solution (§13)
- [x] `/legal/terms`, `/legal/privacy`, `/legal/disclaimer` — DRAFT placeholders
- [x] PWA manifest + hand-written service worker; calculator works offline once loaded
- [x] Unit tests for form → engine input mapping (71 tests across mapping, units, solve, store, flags)
- [x] **Gate** → `phase-2: web shell + calculator`

## Phase 3 — Data model & Supabase §7

- [x] `supabase/migrations` holds the schema as five ordered, plain-SQL migrations
- [x] Reference tables (public read, admin write): `manufacturers`, `cartridges`, `bullets`, `factory_loads`, `suppressors`, `mount_type` enum
- [x] User tables (owner-only RLS): `profiles`, `rifles` (**no serial number field** — asserted by test), `loads`, `rifle_suppressors`, `sessions`, `shot_strings`, `drop_observations`, `poi_shift_observations`, `entitlements`, `events`
- [x] Aggregate tables: `field_aggregates`, `suppressor_deltas` (read gated by `field_data_is_public()` in the database, not the UI)
- [x] `app_flags` seeded: `field_data_public=false`, `field_reveal_threshold_shots=50000`, `min_sessions_to_display=5`, `min_users_to_display=3`
- [x] Also: `waitlist`, `feedback`, `corrections`, verification audit columns (`verified_by`, `verified_at`)
- [x] UUID PKs, `created_at/updated_at` triggers, soft deletes (`archived_at`) on rifles and loads
- [x] TS types + typed client (browser, server, service role) in `@bf/db` and `apps/web/src/lib/supabase`
- [x] Shared Zod schemas in `packages/db/src/schemas.ts` (seed validation + form contracts)
- [x] Seed pipeline: `pnpm seed` validates `supabase/seed/*.csv` with Zod and emits idempotent `seed.sql`; rejects rows without `source_url`; cross-checks bullet diameter against its cartridge
- [x] Seed CSVs from manufacturer public spec pages only:
  - [x] 29 bullets (Hornady ELD Match line, Berger target/tactical lines) across .224, 6mm, 6.5mm, 7mm, .308 and .338
  - [ ] ~30 factory loads — 1 sourced; the rest need page-by-page transcription (NEEDS_CHAD 8)
  - [ ] ~15 suppressors — 0 sourced; manufacturer sites block automated access (NEEDS_CHAD 9)
  - [x] Unreachable/unconfirmable rows → `to_verify.csv` + NEEDS_CHAD (never guessed)
- [x] RLS test: user A cannot read user B's sessions — **runs on every `pnpm test`** against an in-process Postgres (PGlite), rather than skipping without a local Supabase
- [x] **Gate** → `phase-3: supabase schema + seed`

## Phase 4 — Profiles, DOPE cards, Range mode §8

- [x] `/rifles`, `/rifles/[id]`, `/loads/[id]` — Rifle → Loads hierarchy; duplicate, archive and delete
- [x] Works against the store interface, so guest (local) today and Supabase later with no call-site changes
- [x] Temperature sensitivity: muzzle velocity adjusted for the current temperature, with the adjustment shown rather than applied silently
- [x] Trued MV/BC saved on the load with the date and distance; the entered values are preserved and restorable
- [x] Truing UI driven by the engine's Illinois-method solver, surfacing its distance and transonic warnings
- [x] `/dope/[loadId]` with `@react-pdf/renderer`:
  - [x] Header: rifle, load, bullet/BC, MV (+ trued and temperature notes), zero, sight height, clicks, atmosphere, suppressed label
  - [x] Table: range, elevation (unit + clicks), configurable full-value wind columns, velocity, energy, TOF; transonic and subsonic rows shaded
  - [x] Formats: letter, half-page, scope-cap/wrist
  - [ ] Suppressed + unsuppressed side-by-side — deferred to Phase 5, which owns the suppressor data
  - [x] Footer: "Ballistic Forge — verify with live fire" + timestamp + disclaimer
  - [x] Tests render real PDF bytes in all three formats, not just the builder output
- [x] `/range`: profile picker, ±25 yd stepper (plus ±5 fine), wind clock + speed sliders, giant readout, Screen Wake Lock
  - [x] Suppressor toggle present but honest: says there is no measured delta until The Can lands
- [x] `/calc?load=<id>` opens a saved profile, keeping the conditions already on screen
- [x] **Gate** → `phase-4: profiles, dope, range`

## Phase 5 — The Can §9

- [x] Suppressor toggle with resolution order: **Your data** → **Field data (n=…)** (only if public + n ≥ threshold) → "No delta yet" CTA. Never a generic delta — `lib/suppressors/resolve.ts`, fully unit-tested
- [x] `/suppressors`, `/suppressors/[id]`: spec sheet, mount, rated cartridges, verbatim barrel-length restriction, outbound links (manufacturer, PEW Science search)
- [x] Per-rifle measured velocity delta and POI shift recorded on the suppressor page
- [x] `/suppressors/compatibility` checker — pure function in the engine (`suppressorFit.ts`), 44 unit tests:
  - [x] Bore vs bullet diameter, with a tight-clearance warning rather than a false pass
  - [x] Cartridge rated / unlisted-under-max (warn) / larger calibre than max (fail)
  - [x] Thread pitch vs mount: direct / adapter needed (named) / incompatible
  - [x] Barrel-length note verbatim, else unknown — never parsed
  - [x] Missing data → **unknown**, never pass (eight explicit tests, one per missing field)
  - [x] Prominent disclaimer; short, factual baffle-strike messaging
- [x] Range mode's suppressor toggle wired to the real resolution order
- [x] **Gate** → `phase-5: suppressor module`

## Phase 6 — The Field §10

- [ ] `/sessions/new` wizard: rifle/load/suppressor → chrono type → strings (paste/tap, suppressed flag, cold bore) → optional drops & POI shift → review (mean/SD/ES) → submit
- [ ] Conditions pre-filled from last session
- [ ] Drafts autosave locally; offline queue syncs when online
- [ ] CSV import: Garmin Xero + LabRadar parsers if formats confirmable, plus generic column-mapping importer (log in DECISIONS)
- [ ] `/sessions`, `/sessions/[id]` incl. excluded-with-reason visibility for owner
- [ ] Aggregation (pure TS core, unit-tested, invoked by Edge Function / SQL on submit + nightly cron):
  - [ ] Group key: bullet|factory_load × 1" barrel bucket × suppressor
  - [ ] Session = one sample; per-user cap (default 3 sessions/group full weight)
  - [ ] Temp normalization to 59 °F when sensitivity known, else `normalized=false`
  - [ ] Plausibility gates (±20% advertised MV, chrono range, SD < 100) then MAD exclusion (3.5 × scaled MAD)
  - [ ] Trust weighting v1 (chrono type, string length; flagged accounts excluded) — formula in DECISIONS
  - [ ] t-based 95% CI; shown only when n_sessions ≥ min and n_users ≥ 3
  - [ ] Suppressor deltas from same-session paired strings only
  - [ ] Opted-out users excluded; deletion triggers recompute
  - [ ] Stretch: fps-per-inch barrel curve behind admin flag
- [ ] `/field`: personal history (MV over time, SD/ES trends, temp vs MV), "Your shots in the Field Database: N"; community view only when flag on
- [ ] Calculator/library Field MV badge (flag-gated)
- [ ] `/admin` (server-guarded): totals, progress to reveal threshold, flagged-session review queue, group drill-down, flag toggles, reference-data verify/edit
- [ ] Rate limit on session submission
- [ ] **Gate** → `phase-6: field data engine`

## Phase 7 — Library, auth, entitlements, beta readiness §11

- [ ] `/library`: search/filter by cartridge, weight, manufacturer, BC type; verified badges; "Use in calculator"; "Suggest a correction" → admin queue
- [ ] Auth: magic link + Google OAuth (Supabase); guest → account migration of localStorage profiles
- [ ] Entitlements: single Free vs Pro config file; all beta users = `founder`; `useEntitlement()` hook gating Pro candidates
- [ ] Feedback button → `feedback` table (+ optional screenshot to Storage)
- [ ] 3-step onboarding (units → rifle → load) ending on a real solution
- [ ] Empty states everywhere with a clear next action
- [ ] `/account`: units, contribution opt-in, data export (JSON + CSV), delete account
- [ ] **Gate** → `phase-7: library, auth, entitlements`

## Phase 8 — Hardening & handoff §12

- [ ] Playwright smoke: guest calc solve; create account; rifle/load; DOPE PDF; log session; admin sees it; compatibility check
- [ ] Accessibility: keyboard nav, labels on all inputs, AA contrast on dark theme
- [ ] Lighthouse mobile ≥ 85 performance, PWA installable
- [ ] Security review: RLS tests, admin guards, rate limits, no PII leakage in aggregates
- [ ] `.env.example` fully documented; README (local Supabase, seeding, tests, Vercel deploy)
- [ ] `HANDOFF.md`: done / stubbed / run / deploy / physics limitations / coverage / top 10 next tasks / SAAMI sound-standard note
- [ ] Walk the §15 Definition of Done checklist and record results honestly
- [ ] **Gate** → `phase-8: hardening + handoff`

---

## Known blockers for `NEEDS_CHAD.md` (seed in Phase 0)

1. Supabase project URL + anon/service keys (app runs in demo mode until provided)
2. Google OAuth client ID/secret
3. Vercel project + BallisticsMD.com DNS
4. Reference ballistic cases: run 5 loads through JBM + Hornady 4DOF, paste into `reference_cases.json`
5. Verify any seed rows that land in `to_verify.csv`
6. Final logo / brand assets (placeholder shipped)
7. Attorney review of Terms, Privacy, Disclaimer
8. Confirm Garmin Xero / LabRadar CSV export samples (real files from a session)

## Hard lines (apply to every phase) §13

- No reloading/powder data, no AI load advisor, no NFA/legal advice
- No fabricated data: every seed row has `source_url` + `verified`
- No serial numbers, no precise GPS
- Disclaimer on every solution and DOPE card
