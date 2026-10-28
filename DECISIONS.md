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

## Phase 2 — Web shell + calculator

### Framework & styling

- **Next.js 16.4.3 (App Router, Turbopack) + React 19.3, hand-scaffolded rather than `create-next-app`** — the app is a workspace package inside an existing monorepo with a shared strict `tsconfig.base.json`; the generator would have fought all three — delete `apps/web` and re-run the generator if the hand-written config ever drifts.
- **Tailwind CSS v4 with CSS-first `@theme` tokens in `globals.css`; no `tailwind.config.js`** — v4's config lives in CSS, and the brand scale is then readable in one place — add a JS config if a plugin needs it.
- **shadcn/ui components written by hand on Radix primitives instead of running the shadcn CLI** — the CLI assumes its own path aliases and a `components.json`; the eight primitives actually used are small and now match the brand directly — run the CLI into `src/components/ui` if the component count grows.
- **`baseUrl` dropped from `apps/web/tsconfig.json`, `paths` kept** — TS 6 deprecates `baseUrl`; `paths` resolve relative to the tsconfig without it — n/a.
- **Dark only; no theme switcher** — brief §4 makes dark canonical, and a half-done light theme is worse than none — add a `data-theme` layer over the same tokens.

### Calculator

- **The form stores numbers in the unit the user sees, tagged by a `units` block, and `toSolveInput` is the only conversion to SI** — what is on screen round-trips exactly, and there is one tested seam between UI and engine instead of conversions scattered through components — n/a.
- **Switching units converts the stored values (`withUnits`) at a documented per-quantity precision** — flipping to metric must preserve the physical quantity, not reinterpret the number; grams carry 3 decimals so a 140 gr bullet round-trips — edit `DIGITS` in `lib/calc/units.ts`.
- **The solver runs synchronously on the main thread; no Web Worker** — the brief only asks for a worker if the 50 ms budget is exceeded, and it is not: the integrator's cost is set by the time step, not the reported row count, so a full solve measures ~6 ms and three compared loads ~18 ms. `useDeferredValue` keeps typing smooth — move `runCalc` into a worker if a 6DOF or custom-drag model lands.
- **Row cap of 400 (`MAX_ROWS`), reported in the UI when it bites** — a 1 yd step to 3,000 yd would render 3,000 DOM rows for no benefit — raise `MAX_ROWS`.
- **Engine validation paths are mapped to form fields (`lib/calc/issues.ts`) so messages appear under the input that caused them** — a list of errors above the form makes the user hunt — add entries to `PATH_TO_FIELD` when the engine grows a new path.
- **The calculator table shows the actual wind's windage; `buildDope`'s full-value hold columns are reserved for the DOPE card (Phase 4)** — on screen the user has entered a real wind and wants the real answer — n/a.
- **Zero conditions reuse the current pressure, overriding only temperature and altitude** — shooters remember where and how cold they zeroed far more often than the barometer, and those two dominate the density change — add a pressure field to the zero block.
- **The calculator form is persisted to `localStorage` and restored after mount (not during SSR)** — a reload at the range must not lose the setup, and hydration must not mismatch — n/a.

### Chart colours

- **Series palette `#C08209 / #5590D0 / #44A06A`, validated with the dataviz six checks against the `#22223A` chart surface** — all three sit inside the dark lightness band, clear the chroma floor, hold ΔE ≥ 8 under protan/deutan simulation across every pair, and exceed 3:1 contrast. The brand amber `#C8860A` is marginally too light for the band, so slot 0 is one step down — re-run `validate_palette.js` before changing any of them.
- **Colour follows the load, not its position in the list** — removing a compared load must not repaint the survivors — n/a.

### Persistence, flags, PWA

- **`ProfileStore` interface with `LocalStore` (guest) and a `SupabaseStore` stub; `getStore()` returns the local one in Phase 2** — call sites never learn which backend they have, so Phase 3 swaps one line — n/a.
- **The Supabase stub throws rather than returning empty data** — a half-wired project must fail loudly in development, not look like an empty account — n/a.
- **Feature flags and entitlements are compile-time defaults in `lib/flags.ts` / `lib/entitlements.ts`** — Phase 3 moves the source of truth to `app_flags` with these as the fallback — n/a.
- **Service worker written by hand (`public/sw.js`) rather than `next-pwa`** — `next-pwa` is unmaintained for the App Router; the caching rules are 100 readable lines and nothing has to track Next's build output — replace with Serwist if the rules grow.
- **PWA icons generated by `scripts/gen-icons.mjs`, a zero-dependency rasteriser + PNG encoder** — the repo needs no image toolchain and the placeholder mark can be regenerated at any size — point the script at the real artwork, or just overwrite the PNGs (NEEDS_CHAD 5).
- **The placeholder mark is a scope reticle rather than the anvil the brief suggested** — a symmetric anvil silhouette reads as a bowtie at 32 px; the reticle survives the favicon — replace with final artwork.
- **Navigation lists unbuilt sections as disabled "soon" items instead of linking or hiding them** — honest about what the pilot does today without 404s — flip `ready` in `components/shell/nav-items.ts` as each phase lands.
- **The waitlist endpoint logs to the server and tells the caller it was _not_ persisted while in demo mode** — a green tick over a dropped signup is worse than a blunt message — n/a (Phase 3 adds the insert).
- **The pilot is `noindex`** — firearm owners are privacy-sensitive and the beta is invite-only — remove `robots` from the root metadata at launch.
- **"Use my location" reads latitude only, rounds it to 0.1° before it reaches state, and never stores or transmits it** — enough for Coriolis, useless for identifying a shooting position (brief §10.4) — n/a.

## Phase 3 — Data model & Supabase

### Schema

- **Five ordered plain-SQL migrations (`0001_foundation` → `0005_rls_policies`), numbered and sequence-checked by the loader** — readable, reviewable, and applicable by the Supabase CLI or by hand — renumber and update `loadMigrations`.
- **No Postgres extensions at all** — `gen_random_uuid()` has been core since PG13, and the only extension the schema had reached for (`pgcrypto`) was unused; dropping it also let the test harness run on PGlite — add `create extension` back if a future column needs one.
- **Helper functions that read tables (`is_admin`, `field_data_is_public`) live in the RLS migration, not the first one** — SQL-language function bodies are validated at creation, so they cannot be declared before the tables they query — n/a.
- **`is_admin()` is SECURITY DEFINER with a pinned `search_path`** — a policy on `profiles` that calls it would otherwise recurse into itself; definer rights bypass RLS and the pinned path stops them being redirected at a shadowed table — n/a.
- **Reference rows have `source_url NOT NULL`** — the brief's hard line against fabricated data, enforced by the database rather than by convention — n/a.
- **Bullets must carry at least one BC (`bullets_has_a_bc`)** — a bullet with no ballistic coefficient cannot be solved with, so it belongs in `to_verify.csv` — n/a.
- **`cardinality(velocities_fps) >= 1`, not `array_length(...) >= 1`** — `array_length` of an empty array is NULL and a NULL CHECK expression passes, so the original constraint silently allowed empty shot strings. Caught by running the migrations in the test harness — n/a.
- **Suppressor specs stay NULL when unknown** — the compatibility checker must be able to answer "unknown" rather than infer a pass — n/a.
- **No serial-number column anywhere, asserted by a test that greps `information_schema`** — the brief forbids the field; a test stops it reappearing — n/a.

### Row-level security

- **Every table has RLS enabled and at least one policy, both asserted by test** — a table with RLS and no policy is invisible; one without RLS is wide open. The tests catch either mistake — n/a.
- **Policies use `(select auth.uid())` rather than a bare call** — the planner then evaluates it once per statement instead of once per row — n/a.
- **Admins can read user sessions for the review queue but cannot write them** — the admin policies are SELECT-only, so an admin editing someone's data fails the owner policy's USING clause — n/a.
- **The field-data reveal is enforced in the database** (`field_aggregates` / `suppressor_deltas` select policies call `field_data_is_public()`) — a UI bug can then never leak community aggregates early — flip the `app_flags` row.
- **A trigger stops users changing their own `role` or `flagged`, but allows it when `auth.uid()` is null** — that null case is a migration, the SQL editor or the service role, and RLS already keeps anon off the table, so it is a trusted server context. Without the exemption even the service role could not promote an admin — n/a.

### Testing

- **The RLS suite runs against PGlite (real Postgres compiled to WASM) instead of skipping without a local Supabase** — the brief allowed it to skip; running the actual migrations and actual policies on every `pnpm test` is strictly better, needs no Docker, and already caught two real defects — point `createTestDb` at a connection string if a full Supabase is ever available in CI.
- **The harness stands up only what Supabase itself provides** — the `auth` schema, `auth.uid()`, and the `anon`/`authenticated`/`service_role` roles. Nothing under test is faked — n/a.
- **`TABLES` and `DEFAULTED_COLUMNS` in the TypeScript types are checked against `information_schema` by test** — hand-maintained types cannot silently drift from the migrations — regenerate with `supabase gen types` once a project exists, and keep the drift tests.

### Types and client

- **Database row types are object _type aliases_, not interfaces** — supabase-js constrains a schema's tables to `Record<string, unknown>`; interfaces have no implicit index signature, fail that constraint, and silently degrade every `Insert` to `never`. ESLint's `consistent-type-definitions` is disabled for that one file with the reason inline — n/a.
- **`Insert` makes nullable and database-defaulted columns optional, driven by a single `DEFAULTED_COLUMNS` list** — matches what Postgres will actually accept, and the list is validated against `information_schema` in both directions — n/a.
- **`getBrowserClient()` / `getServerClient()` return null in demo mode rather than throwing** — the calculator must keep working with no backend, and a module-scope throw would take the page down — n/a.

### Seed pipeline

- **`pnpm seed` emits `supabase/seed/seed.sql` rather than connecting to a database** — it works with no project configured, produces a reviewable diff, and can be executed against the test Postgres; a test asserts the committed `seed.sql` matches the CSVs — n/a.
- **Generated SQL resolves foreign keys with inline sub-selects and `on conflict do nothing`** — no UUIDs to invent, and re-applying the file is a no-op — n/a.
- **Hand-rolled CSV reader instead of a dependency** — one consumer, a fixed dialect, and the behaviour that matters (quoted commas, escaped quotes, embedded newlines) is sixty lines and directly tested — n/a.
- **Seed CLI runs on Node's native type stripping, so `packages/db` sets `allowImportingTsExtensions` and `erasableSyntaxOnly`** — avoids adding `tsx` (whose esbuild postinstall pnpm's supply-chain policy blocks), and the compiler now rejects the non-erasable syntax that would break it — add a runner dependency if the CLI grows.
- **Only 29 bullets and 1 factory load are seeded, and 0 suppressors** — every value was transcribed from the manufacturer's own published page (Hornady's BC table, Berger's bullet reference chart, Hornady's ammunition page). Suppressor manufacturer sites return 403/404 to automated requests, so nothing was seeded rather than guessed — see NEEDS_CHAD 8 and 9.

## Phase 4 — Profiles, DOPE cards, Range mode

- **Profiles are stored in US customary units and converted at the boundary (`formFromProfile`)** — what the user typed round-trips exactly, and there is one tested seam between stored data and the calculator — n/a.
- **The effective muzzle velocity is resolved in one place and reports its working** — a trued value beats the entered one, then powder temperature sensitivity is applied, and the UI shows each step. A solver that silently changes the number you typed is worse than one that explains itself — `effectiveMuzzleVelocity` in `lib/profiles/to-form.ts`.
- **Truing never overwrites the entered MV or BC** — the trued figure is stored beside it with the date and distance, and can be cleared. Truing from one group carries that group's error, so the original has to survive — n/a.
- **Archive is a flag; delete is a separate, confirmed action** — archiving a rifle should not destroy its loads, but an explicit delete should mean it — n/a.
- **`/calc?load=<id>` keeps the conditions already on screen** — loading a profile changes the rifle and load, not the weather you just entered — n/a.
- **DOPE card content is resolved to strings in `lib/dope/build.ts`, away from the PDF components** — the numbers are then testable without rendering a document, and the preview table and the PDF cannot disagree — n/a.
- **The printed card is black on white, with transonic rows shaded rather than coloured** — it is the one surface that leaves the screen, and it has to survive a photocopier, a wet range bag and direct sun — n/a.
- **Three formats differ by column set as well as page size** — a scope-cap band that tried to carry energy and time of flight would be unreadable — edit `DOPE_FORMATS`.
- **PDF tests render real bytes with `renderToBuffer` in all three formats** — the builder passing says nothing about whether the document renders; this catches a broken layout or a bad style — n/a.
- **`@react-pdf/renderer` is loaded with `next/dynamic` and `ssr: false`** — it touches browser APIs at import time and would break prerendering — n/a.
- **`@vitejs/plugin-react` added for the test runner** — the app's tsconfig sets `jsx: preserve` so Next owns the transform; Vite 8 honours that and leaves JSX in place, so tests importing a `.tsx` module need their own transform — n/a.
- **Range mode reads its conditions from the calculator's saved form** — one place to enter the weather, and the range screen stays a readout rather than a second data-entry surface — n/a.
- **Screen Wake Lock is reacquired on `visibilitychange`** — browsers drop the lock when the tab is backgrounded, and a display that sleeps between shots is the whole problem it solves — n/a.
- **Range mode's suppressor toggle states that no delta is recorded instead of offering a generic one** — the brief's resolution order ends at "No delta yet", never at an invented number. It is wired for real in Phase 5 — n/a.
