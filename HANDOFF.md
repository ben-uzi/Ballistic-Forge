# Handoff

The state of Ballistic Forge at the end of the pilot build, written to be useful to whoever picks
it up next — including the parts that are shaky.

## Status

All eight phases are complete. **494 unit and integration tests pass** across the three packages,
including 5 external reference trajectories (added 2026-10-29), plus 34 Playwright end-to-end tests
on desktop and mobile viewports (last run at the end of phase 8; the reference-case change touched
only engine tests).

| Phase | Scope                                  | State |
| ----- | -------------------------------------- | ----- |
| 0     | Monorepo scaffold, tooling             | Done  |
| 1     | `@bf/engine` — the physics             | Done  |
| 2     | Web shell + calculator                 | Done  |
| 3     | Supabase schema, RLS, seed pipeline    | Done  |
| 4     | Profiles, DOPE cards, range mode       | Done  |
| 5     | The Can — suppressor module            | Done  |
| 6     | The Field — logging + aggregation      | Done  |
| 7     | Library, account, onboarding           | Done  |
| 8     | Hardening, E2E, accessibility, handoff | Done  |

Engine coverage: **99.7% lines, 93.2% branches, 100% functions**.

## Running it

```sh
pnpm install
pnpm dev                           # http://localhost:3000 — works with no env vars
pnpm gate                          # typecheck + lint + 494 tests
pnpm --filter @bf/web e2e          # 34 end-to-end tests
pnpm seed                          # validate seed CSVs, regenerate seed.sql + the bundled library
```

See [`README.md`](README.md) for local Supabase, seeding and the Vercel settings.

## What works today

Everything below runs with **no backend**, storing data in the browser.

| Route                                                             | What                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                               | Landing, three pillars, beta waitlist                                                                                                                                                                                     |
| `/calc`                                                           | The solver: collapsible input groups, sticky solution table with transonic flagging, Drop/Velocity/Energy/Drift charts, compare up to three loads, US and metric throughout, inline validation, works offline once loaded |
| `/rifles`, `/rifles/[id]`, `/loads/[id]`                          | Rifle → load profiles; duplicate, archive, delete; powder-temperature correction and truing, both of which show their working                                                                                             |
| `/dope/[loadId]`                                                  | DOPE card as a real PDF in three formats (letter, half page, scope cap)                                                                                                                                                   |
| `/range`                                                          | One distance, huge numbers, wind sliders, screen stays awake, suppressor toggle                                                                                                                                           |
| `/suppressors`, `/suppressors/[id]`, `/suppressors/compatibility` | The Can: specs, a compatibility checker that answers "unknown" rather than guessing, your own measured velocity deltas                                                                                                    |
| `/sessions`, `/sessions/new`, `/sessions/[id]`                    | Five-step logging wizard with draft autosave and chronograph CSV import; per-session reasons for whether it would count towards an aggregate                                                                              |
| `/field`                                                          | Your velocity history over time and by load; community view explicitly gated                                                                                                                                              |
| `/library`                                                        | 29 bullets from manufacturer pages, searchable and filterable, each badged unverified                                                                                                                                     |
| `/account`                                                        | Units, contribution opt-in, JSON/CSV export, JSON import, delete everything                                                                                                                                               |
| `/onboarding`                                                     | Three steps ending on a real solution                                                                                                                                                                                     |
| `/feedback`                                                       | Feedback and library corrections                                                                                                                                                                                          |
| `/admin`                                                          | Server-guarded; says plainly it needs a backend                                                                                                                                                                           |
| `/legal/*`                                                        | DRAFT terms, privacy, disclaimer                                                                                                                                                                                          |

## What is stubbed, and why

| Thing                            | State                                                                                             | Blocked on                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts, sign-in, sync          | Typed clients, RLS policies and the profile-creation trigger are built and tested. No sign-in UI. | A Supabase project and Google OAuth credentials (NEEDS_CHAD 1, 2). A sign-in form that cannot sign anyone in would be worse than its absence. |
| Server-side aggregation          | The aggregation core is finished, with 44 tests. Nothing invokes it on submit or nightly.         | The backend. It is a pure function over fetched rows — wiring it into an Edge Function is a small job.                                        |
| Offline session queue            | Drafts autosave locally; there is no sync queue.                                                  | The backend. Nothing to sync to.                                                                                                              |
| Field MV badge in the calculator | Not wired.                                                                                        | Real aggregates. The flag is off and there is no data to badge.                                                                               |
| Device-specific chrono parsers   | A generic importer handles both devices in practice.                                              | Real Garmin Xero and LabRadar export files (NEEDS_CHAD 7).                                                                                    |
| Payments                         | `entitlements` table and a single tier config. Every beta user is a `founder`.                    | Deliberately out of scope for the pilot.                                                                                                      |
| Suppressor library               | Ships empty; the module works against suppressors you enter.                                      | Manufacturer sites refuse automated requests (NEEDS_CHAD 9).                                                                                  |
| Seed data breadth                | 29 bullets, 1 factory load, 1 cartridge.                                                          | Page-by-page transcription (NEEDS_CHAD 8, 10).                                                                                                |

## Engine: known physics limitations

These are the honest edges of the model. Read them before trusting a number at distance.

- **Point-mass (3DOF)** with standard G1/G7 drag functions. No 6DOF, no custom drag curves yet —
  the `DragModel` interface is ready for them.
- **Drag tables were transcribed, not downloaded.** They have since been compared row by row with
  py-ballisticcalc 3.1.1's G1 (79 rows) and G7 (84 rows) tables and match exactly. The JBM file
  comparison in NEEDS_CHAD 4a has not been done.
- **Validated against one external solver, not yet two.** `reference_cases.json` holds 5 cases
  (50 rows, 100–1,200 yd, G1 and G7, standard and non-standard air, wind) from py-ballisticcalc 3.1.1.
  All pass the file's tolerance bands with a lot of room: at most 0.005 MRAD of elevation or wind
  difference (the rounding of the reference values) and under 1 fps of velocity, transonic included.
  py-ballisticcalc descends from JBM, so this shows the engine does what that family of solvers
  does. It does not show both are right. Still untested externally: incline, spin drift, Coriolis,
  and a solver from a different lineage (NEEDS_CHAD 4).
- **Wind clock conventions differ between solvers.** py-ballisticcalc's 3 o'clock is a wind from the
  _left_; ours is from the right. The fixture converts this explicitly (see its README). Anyone
  adding reference data from another tool should check this first.
- **Constant atmosphere along the flight path** — no density change with bullet height.
- **Single constant wind zone**; no vertical wind.
- **Spin drift is the Litz empirical formula**, applied as a lateral offset after integration. No
  lateral zero, so drift accrues from the muzzle.
- **Aerodynamic jump** is an empirical approximation, off by default and unverified (NEEDS_CHAD 4b).
- **Stability uses the Miller rule**, which is less accurate for very long, plastic-tipped or
  monolithic bullets.
- **No scope cant** input.
- **Saturation vapour pressure uses the over-water formula** at all temperatures — a tiny error
  below 0 °C.

## A note on suppressor sound data

There is no decibel data in this product and that is deliberate. Suppressor sound measurement is
governed by **SAAMI Z299.6** (and, historically, MIL-STD-1474), which specifies microphone
placement, environment and metric. Numbers measured any other way are not comparable, and the
marketing figures manufacturers publish are frequently not comparable with each other. Adding a
"dB" column that mixed those sources would be exactly the kind of confident-looking wrong number
this product exists to avoid.

If sound data is ever added, it should come from a single methodologically consistent source. PEW
Science is the obvious candidate — the suppressor pages link out to it rather than reproducing it,
because their work is theirs.

## Where things live

The web app never calls the engine from a component. The seam is `apps/web/src/lib/calc/`:

| Module      | Responsibility                                                   |
| ----------- | ---------------------------------------------------------------- |
| `types.ts`  | `CalcForm` — every number in the unit the user sees              |
| `map.ts`    | the only conversion from form units to the engine's SI input     |
| `units.ts`  | re-expressing a form in different units without changing physics |
| `solve.ts`  | `runCalc()` — validate, solve, attach turret corrections         |
| `issues.ts` | engine validation paths → form fields                            |
| `format.ts` | display formatting                                               |

Other seams worth knowing:

| Concern                  | Where                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Schema                   | `supabase/migrations/0001…0005`                                     |
| Row types, `Database`    | `packages/db/src/types.ts` (hand-maintained; drift-checked by test) |
| Zod schemas              | `packages/db/src/schemas.ts`                                        |
| Field aggregation        | `packages/db/src/aggregate.ts`                                      |
| Chronograph import       | `packages/db/src/chrono.ts`                                         |
| Suppressor compatibility | `packages/engine/src/suppressorFit.ts`                              |
| Persistence              | `getStore()` in `apps/web/src/lib/store/`                           |

## Accessibility

- Every input has a label; the solution table has a caption and scoped headers.
- All interactive targets clear 44 px.
- Contrast is **measured, not assumed**: every text token used for content clears WCAG AA (4.5:1)
  against the darkest card surface. `ink-700` sits below that deliberately and is used only for
  disabled controls, which WCAG exempts.
- `prefers-reduced-motion` is honoured; pinch-zoom is never disabled; there is a skip link.

## The top ten things to do next

1. **Create the Supabase project** and paste the keys into `apps/web/.env.local` (NEEDS_CHAD 1).
   Everything marked "stubbed" above unblocks from this one step.
2. **Add a second reference solver** from a different lineage (Hornady 4DOF or Applied Ballistics),
   plus incline cases, to `reference_cases.json` (NEEDS_CHAD 4). The py-ballisticcalc cases already
   pass; a second, unrelated solver is what turns "agrees with one solver" into "agrees with
   established solvers".
3. **Close out the G1/G7 drag table check** against JBM's published files (NEEDS_CHAD 4a). The
   tables already match py-ballisticcalc exactly, so this should be a five-minute confirmation.
4. **Build the sign-in UI** (magic link + Google) and the guest → account migration, which already
   has its data path in `exportAll`/`importAll`.
5. **Wire the aggregation core into an Edge Function** on session submit, plus a nightly
   recompute. The function is written and tested; it needs a trigger and a writer.
6. **Transcribe the remaining seed data** — factory loads, cartridges and suppressors
   (NEEDS_CHAD 8, 9, 10). The pipeline validates and rejects, so this is safe grunt work.
7. **Attorney review of `/legal/*`** before any tester sees it (NEEDS_CHAD 6).
8. **Verify the aerodynamic jump formula** against Litz before considering turning it on
   (NEEDS_CHAD 4b).
9. **Replace the placeholder brand assets** (NEEDS_CHAD 5) and re-run `node scripts/gen-icons.mjs`.
10. **Run Lighthouse on a real mobile device** against a production deploy. The app is built for it
    — PWA manifest, service worker, offline calculator — but the score has not been measured on
    real hardware, only reasoned about.

## Definition of Done, walked honestly

| Criterion                                                                                                        | Verdict                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens the site on a phone, picks a load, enters conditions, gets a 0–1,200 yd solution in under 30 seconds | **Yes.** Covered by an end-to-end test on a Pixel 7 viewport; the calculator solves on load with no input.                            |
| Engine passes all §5.8 tests; reference harness skips cleanly until filled                                       | **Yes.** 191 engine tests; the reference harness now runs 5 py-ballisticcalc cases, all passing.                                      |
| Logged-in user creates rifle → load → suppressor, toggles suppressed, prints a DOPE card in 3 formats            | **Partly.** All of it works as a guest, and PDFs are rendered to real bytes in all three formats by test. "Logged-in" needs accounts. |
| User logs a session, sees their stats, and it lands in aggregates server-side                                    | **Partly.** Logging and personal stats work; the server-side half needs the backend.                                                  |
| Field aggregates compute correctly with outlier handling, CI, user caps — hidden while the flag is off           | **Yes.** 44 tests on the core; the flag gate is enforced in row-level security and tested.                                            |
| Compatibility checker returns pass/warn/fail/unknown and never passes on missing data                            | **Yes.** 44 tests, including one per missing field.                                                                                   |
| Every seed row has a source and verified flag; unverified data is visibly badged                                 | **Yes.** `source_url` is `NOT NULL`; nothing ships verified; the library badges every row.                                            |
| RLS verified by test. Data export and account deletion work                                                      | **Yes** for RLS (real Postgres, real policies) and for export. Deletion is a local wipe — there is no account to delete yet.          |
| Deployed-ready to Vercel; README and `.env.example` complete                                                     | **Ready, not deployed.** Settings are in the README; no project was created, by request.                                              |
| `HANDOFF.md` written honestly, including what is shaky                                                           | This document.                                                                                                                        |

The two things that were shaky at handoff are now partly resolved. **The engine agrees with
py-ballisticcalc** to the rounding of its output across five cases out to 1,200 yd, and **the
hand-typed drag tables match py-ballisticcalc's exactly**. What remains shaky: that solver shares
JBM's lineage, so a second, unrelated solver and a field check are still needed before the numbers
can be called validated.
