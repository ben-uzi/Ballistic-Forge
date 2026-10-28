# Handoff

_Running draft. Written in full at the end of Phase 8 (see `docs/BUILD_BRIEF.md` §0.9)._

## Status

- Phase 0 (scaffold) — complete.
- Phase 1 (engine) — complete. 143 tests; 99.8% line / 92.9% branch coverage.
- Phase 2 (web shell + calculator) — complete. 71 further tests.
- Phase 3 (Supabase schema, RLS, seed pipeline) — complete. 72 further tests, run against a real
  Postgres. Seed data is partial on purpose: see NEEDS_CHAD 8-10. See `PLAN.md`.

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000 — the calculator works with no env vars
pnpm gate           # typecheck + lint + test, the bar every phase must clear
pnpm seed           # validate supabase/seed/*.csv and regenerate seed.sql
```

The database tests need no Docker and no Supabase project: they apply the real migrations to
PGlite (Postgres compiled to WebAssembly) and exercise the real row-level security policies.

With no `.env.local` the app is in **demo mode**: the calculator is fully functional, profiles are
stored in the browser, and there are no accounts. `apps/web/.env.example` documents what to fill in
(NEEDS_CHAD 1).

## What works today

- `/` — landing, three pillars, beta waitlist (logs to the server in demo mode and says so).
- `/calc` — the solver: bullet/load, rifle and conditions groups; sticky solution table with
  transonic flagging; Drop / Velocity / Energy / Drift charts; compare up to three loads; US and
  metric units throughout; inline validation; works offline once loaded.
- `/legal/*` — DRAFT terms, privacy and disclaimer.

Everything else in the navigation is shown as "soon" and is not yet built.

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

## Web quick reference

The web app never calls the engine directly from a component. The seam is
`apps/web/src/lib/calc/`:

| Module      | Responsibility                                                   |
| ----------- | ---------------------------------------------------------------- |
| `types.ts`  | `CalcForm` — every number in the unit the user sees              |
| `map.ts`    | the only conversion from form units to the engine's SI input     |
| `units.ts`  | re-expressing a form in different units without changing physics |
| `solve.ts`  | `runCalc()` — validate, solve, attach turret corrections         |
| `issues.ts` | engine validation paths → form fields                            |
| `format.ts` | display formatting                                               |

Persistence goes through `getStore()` (`lib/store/`), which returns the guest `LocalStore` today and
a `SupabaseStore` once the backend exists.

## Database quick reference

The schema lives in `supabase/migrations` as five ordered plain-SQL files. `@bf/db` holds the
TypeScript row types, the shared Zod schemas, and the seed pipeline.

| Thing                      | Where                                             |
| -------------------------- | ------------------------------------------------- |
| Schema                     | `supabase/migrations/0001…0005`                   |
| Row types, `Database`      | `packages/db/src/types.ts`                        |
| Zod schemas (seed + forms) | `packages/db/src/schemas.ts`                      |
| Seed loader                | `packages/db/src/cli/seed.ts`, run as `pnpm seed` |
| Seed data                  | `supabase/seed/*.csv` → generated `seed.sql`      |
| Typed clients              | `apps/web/src/lib/supabase/{client,server}.ts`    |

Row-level security in one line: user data is owner-only, reference data is world-readable and
admin-writable, and community aggregates are invisible to non-admins until the `field_data_public`
flag is switched on — enforced by policy, not by the UI.

**Hand-maintained types.** `supabase gen types` needs a running project, so `packages/db/src/types.ts`
is written by hand. Two tests compare it against `information_schema` (table list and defaulted
columns), so it cannot drift silently. Regenerate properly once a project exists.
