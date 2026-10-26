# Ballistic Forge — Pilot Build Brief (v3)
### "Built in the Lab. Proven in the Field."

> **How to use this file**
> 1. Create an empty repo, save this file as `docs/BUILD_BRIEF.md`.
> 2. If you still have the old React prototype, drop it in `legacy/` (optional).
> 3. Open Cursor → Agent mode (Claude, max context) and paste the kickoff message below.

```
Read docs/BUILD_BRIEF.md in full before writing any code. It is the complete spec for
the Ballistic Forge pilot. Follow its "Agent Operating Rules" exactly: create PLAN.md,
then build phase by phase without stopping to ask me questions. Log decisions in
DECISIONS.md, blockers in NEEDS_CHAD.md, and finish with HANDOFF.md. Go.
```

---

## 0. Agent Operating Rules (read first, follow always)

You are the sole engineer building a **nearly finished pilot** of Ballistic Forge. The founder (Chad) works a full-time job and will review your output in batches. Optimize for a working, honest, testable product he can put in front of 20–50 beta shooters.

1. **Plan first.** Before coding, write `PLAN.md`: every phase below broken into checkbox tasks. Tick boxes as you go. Keep it current — it's how Chad sees progress.
2. **Don't stop to ask.** When something is ambiguous, pick the most reasonable option, record it in `DECISIONS.md` (one line: decision, reason, how to reverse), and keep moving.
3. **Blockers go in `NEEDS_CHAD.md`.** Anything you truly can't do (API keys, Supabase project, domain DNS, legal copy, data you can't verify) is logged there with exact instructions for Chad. Then build around it (mocks, demo mode, feature flags) — never stall.
4. **Phase gates.** At the end of each phase: `pnpm typecheck && pnpm lint && pnpm test` must pass. Commit with message `phase-N: <summary>`. Don't start the next phase with red tests.
5. **Never fabricate data.** No invented BCs, muzzle velocities, suppressor specs, reference trajectories, user counts, or testimonials. Every seed data row carries a `source_url` and `verified` flag. If you can't source it, ship it as `verified=false` with a visible "Unverified sample data" badge, or leave it out.
6. **The engine is the product.** Physics correctness beats UI polish. If you're short on time, cut UI scope, not engine tests.
7. **Works without credentials.** The calculator, rifle profiles (local), and DOPE card export must work with zero env vars (demo/guest mode using localStorage). Supabase features light up when keys exist.
8. **Small, readable code.** TypeScript strict. No `any` in the engine. Pure functions in the engine package — no React, no DOM, no network.
9. **End with `HANDOFF.md`:** what's done, what's stubbed, how to run it, how to deploy, known physics limitations, test coverage summary, and the top 10 next tasks in priority order.

---

## 1. Product Summary

**Ballistic Forge** is a brand-agnostic precision ballistics platform for hunters, long-range shooters, and suppressor owners. Domain owned: BallisticsMD.com (brand name stays "Ballistic Forge").

**Three pillars:**
1. **The Lab** — an accurate, beautifully simple point-mass ballistics solver (G1/G7) with real atmospherics, wind, spin drift, Coriolis, incline, zeroing, and truing. Works for any bullet from any manufacturer — no brand funnel (Hornady's app exists mainly to sell Hornady).
2. **The Can** — a suppressor module nobody else has built into a solver: suppressed/unsuppressed profile toggle with automatic MV and POI-shift adjustment, a mount/caliber compatibility checker, and logged velocity deltas per suppressor.
3. **The Field** — a crowdsourced shot data engine. Every logged session (chrono strings, observed drops, suppressor on/off) feeds an aggregate model that will eventually show *"6.5 CM 140 ELD-M, 24" barrel — field MV 2,6xx fps ± SD (n = sessions)"* next to the calculator output.

**Phased reveal strategy (must be built into the product):** Field data collects silently from day one. Public aggregate views stay hidden behind a feature flag until a threshold (default 50,000 logged shots) — then it becomes the launch moment. Users always see their *own* data and a "You've contributed N shots to the Field Database" counter.

**Pilot audience:** 20–50 invited beta testers from r/longrange, r/Suppressors, r/PrecisionRifleNetwork. Web app (mobile-first PWA). Native apps come later and must reuse the engine package unchanged.

**Tone of voice:** Direct, confident, zero fluff. Real numbers. No marketing BS. Show uncertainty honestly.

---

## 2. Tech Stack (decided — don't relitigate)

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | `packages/engine`, `apps/web` |
| Engine | Pure TypeScript package `@bf/engine` | Zero runtime deps. Will be reused by Expo/React Native later. |
| Web | Next.js (latest stable, App Router) + TypeScript strict | Deploy target: Vercel free tier |
| Styling | Tailwind CSS + shadcn/ui (restyled to brand) | Dark theme is default and primary |
| Charts | Recharts | Drop, velocity, energy, wind drift |
| Backend | Supabase (Postgres, Auth, RLS, Storage) | Free tier. Migrations in `supabase/migrations`. |
| Auth | Supabase magic link + Google OAuth | Guest mode without login |
| PDF | `@react-pdf/renderer` | DOPE cards |
| Validation | Zod | Shared schemas for forms + API |
| Tests | Vitest (engine + utils), Playwright (smoke) | |
| PWA | next-pwa or equivalent manifest + service worker | Calculator must work offline once loaded |
| Payments | **Stubbed only** — `entitlements` table + feature flags | RevenueCat/Stripe come post-pilot |
| Analytics | Simple `events` table (no third-party trackers in pilot) | Firearm owners are privacy-sensitive |

If a `legacy/` prototype exists: mine its caliber list and visual style, **rebuild the engine from scratch** to this spec, and note any discrepancies in `DECISIONS.md`.

---

## 3. Repository Layout

```
/
├─ docs/BUILD_BRIEF.md            (this file)
├─ PLAN.md  DECISIONS.md  NEEDS_CHAD.md  HANDOFF.md
├─ packages/engine/
│  ├─ src/
│  │  ├─ units.ts                 conversions, all SI internally
│  │  ├─ atmosphere.ts            density, speed of sound, density altitude
│  │  ├─ dragTables.ts            G1, G7 standard Mach→Cd tables + interpolation
│  │  ├─ solver.ts                RK4 point-mass integrator (3D)
│  │  ├─ zero.ts                  zero-angle solver
│  │  ├─ spinDrift.ts             Miller stability + Litz spin drift
│  │  ├─ coriolis.ts
│  │  ├─ truing.ts                MV and BC truing from observed data
│  │  ├─ suppressor.ts            apply MV delta + POI offset to a profile
│  │  ├─ dope.ts                  table generation, angular conversions, clicks
│  │  ├─ stats.ts                 mean, SD, ES, MAD, CI, outlier filtering
│  │  └─ index.ts
│  └─ test/
│     ├─ fixtures/reference_cases.json   (empty schema, Chad fills — see §5.8)
│     └─ *.test.ts
├─ apps/web/                      Next.js app
├─ supabase/
│  ├─ migrations/
│  └─ seed/                       CSVs + loader script
└─ scripts/                       data import/validation scripts
```

---

## 4. Brand & UI Direction

- **Primary background:** Gunmetal `#1C1C2E` (build a scale: 950 → 600 for surfaces, cards, borders).
- **Accent:** Amber `#C8860A` — reticle and brass. Use for primary actions, key numbers, active states. Sparingly.
- **Status colors:** muted green (verified/pass), amber (warn), muted red (fail/transonic). Never neon.
- **Type:** Source Code Pro (or JetBrains Mono) for all numbers and data tables; Inter for UI text. Numbers use tabular figures.
- **Feel:** like a quality scope or a machined receiver — dense but calm, precise, no gradients-for-the-sake-of-it, no stock gun photos.
- **Mobile-first:** the primary use is a phone at the range, sometimes with gloves. Big tap targets (≥44px), high contrast, a large "range readout" mode (one distance, huge elevation + wind numbers).
- **Logo placeholder:** simple anvil-or-crosshair glyph + "BALLISTIC FORGE" wordmark in SVG. Mark it as placeholder in `NEEDS_CHAD.md`.
- Light mode optional; dark is canonical.

---

## 5. Phase 1 — The Engine (`@bf/engine`)

This phase is the foundation. Build it test-first.

### 5.1 Units
- All internal math in SI (m, s, kg, K, Pa, rad).
- Conversions for: yd/m/ft/in/cm, fps/mps, gr/g/kg, °F/°C, inHg/hPa/mbar/psi, mph/kph/mps, ft-lbf/J, MOA/MIL/IPHY/radians.
- **MOA = true minute of angle** (1/60°, ≈1.047 in @ 100 yd). Offer IPHY ("shooter's MOA") as a separate unit.
- BC conversion: 1 lb/in² = 703.0696 kg/m².

### 5.2 Atmosphere
- Inputs: temperature, **station pressure** *or* barometric (sea-level-corrected) pressure + altitude, relative humidity. Make the station-vs-baro distinction explicit in the UI (common user error).
- Air density with humidity: dry-air + water-vapor partial pressures; saturation vapor pressure via Arden Buck (or Tetens — note choice).
- Speed of sound from temperature (γ = 1.4, R = 287.05 J/kg·K).
- Report density altitude.
- Defaults: ICAO standard atmosphere (15 °C, 101,325 Pa, 0% RH) and an "Army Standard Metro" option, documented.

### 5.3 Drag
- Include the standard **G1 and G7** Mach→Cd tables (public-domain BRL/standard tables). Put a source comment at the top of the file. Linear interpolation between points; clamp at ends.
- Deceleration from drag (SI, BC in kg/m²):
  `a_drag = (π/8) · ρ · v_rel² · Cd_G(Mach) / BC`  directed opposite air-relative velocity.
- Support **multiple BCs by velocity band** (Sierra-style stepped G1) as an optional input.
- Architect so a custom drag model (CDM) can plug in later — define a `DragModel` interface.

### 5.4 Solver
- 3D point-mass, **RK4**, fixed small step (start at 0.5 ms, make configurable; add a test that halving dt changes drop at 1,000 yd by < 0.05%).
- State: position (downrange, vertical, lateral) and velocity, ground frame. Air-relative velocity = v − wind vector.
- Gravity vector rotated by **inclination angle** (true incline integration — not the rifleman's rule; optionally show the cosine-rule comparison in an "advanced" panel).
- Wind: speed + direction (clock or degrees), with full-value/head/tail components. Pilot: single constant wind. Leave interface room for multi-zone wind.
- Coriolis (optional toggle): latitude + azimuth of fire, Ω = 7.292115e-5 rad/s, applied as acceleration in the integrator.
- Spin drift: Miller twist rule for stability factor Sg (needs bullet length, diameter, weight, twist, MV, temperature/pressure correction), Litz approximation for drift vs. time of flight. If bullet length is unknown, disable spin drift and say so.
- Aerodynamic jump (Litz approximation) — optional toggle; fine to stub with a clear TODO if time-boxed.
- Stop conditions: max range reached, or velocity below a floor, or time cap.
- Output per range step: range, drop (in/cm), elevation correction (MOA/MIL/clicks), windage (in/cm + angular + clicks), velocity, Mach, energy, TOF, spin drift, Coriolis components, and a **transonic flag** (Mach ≤ 1.2 warn, ≤ 1.0 subsonic).
- Energy: ft-lbf = weight_gr × v_fps² / 450,240 (also compute from SI and assert they agree).

### 5.5 Zeroing
- Inputs: zero range, sight height (bore-to-scope center), zero atmosphere (can differ from current — this matters), optional zero offset (POI at zero, e.g. "1.5 in high at 100").
- Solve launch angle with bisection/secant so the trajectory crosses line of sight at zero range. Tolerance < 0.001 in.
- Then all outputs are relative to line of sight at current conditions.

### 5.6 Corrections & turrets
- Turret click value per profile: 0.1 MIL, 0.25 MOA, 1/8 MOA, custom. Elevation and windage can differ.
- Show holds in user's reticle unit and clicks; rounding mode configurable (nearest / down).

### 5.7 Truing ("Proven in the Field" in the solver)
- **MV truing:** user enters observed elevation correction that actually hit at distance D → solve MV (secant method) so model matches. Show "trued MV" vs "chrono MV".
- **BC truing** at long range (beyond ~transonic onset): solve BC scale factor. Warn when inputs are inconsistent (e.g. truing distance too short to be meaningful).
- Trued values are saved on the load profile with the date and conditions, never overwrite the original.

### 5.8 Engine tests (required)
- Vacuum case (Cd = 0): matches analytical parabola within 1e-6 relative.
- Zero condition: path crosses LOS at zero range within tolerance.
- Velocity strictly decreasing in still air, flat fire.
- Step-size convergence (see 5.4).
- Unit round-trips.
- Atmosphere: standard conditions produce standard density within 0.1%.
- Wind symmetry: 3 o'clock vs 9 o'clock wind give mirror-image drift.
- Incline: uphill and downhill same angle give nearly identical corrections (gravity-dominant), and both less than flat.
- Truing: synthetic round-trip (solve forward with MV₁, true from that output, recover MV₁ within 1 fps).
- **External reference cases:** create `test/fixtures/reference_cases.json` with a documented schema (inputs + expected drop/wind/velocity at ranges + `source` field). **Leave it empty** — do NOT invent expected values. Tests for it must skip when empty. Add a `NEEDS_CHAD.md` item: "Run 5 loads through JBM Ballistics and Hornady 4DOF, paste outputs into reference_cases.json." Target tolerance once filled: drop within 0.1 MIL to 1,000 yd for G7 match bullets.
- Engine target: ≥ 90% line coverage.

---

## 6. Phase 2 — Web App Shell + Calculator

### 6.1 Pages
| Route | Purpose |
|---|---|
| `/` | Landing: tagline, three pillars, "Join the beta" (stores email in Supabase `waitlist`, or local log in demo mode). No fake stats. |
| `/calc` | The calculator. Works logged out. |
| `/range` | Range readout mode: pick profile + distance, giant numbers, wind slider, suppressor toggle. |
| `/rifles`, `/rifles/[id]` | Rifle profiles |
| `/loads/[id]` | Load profile (under a rifle) |
| `/sessions`, `/sessions/new`, `/sessions/[id]` | Field session logging |
| `/suppressors`, `/suppressors/[id]`, `/suppressors/compatibility` | The Can |
| `/field` | Field Data — personal stats always; community aggregates only when flag is on |
| `/dope/[loadId]` | DOPE card builder + PDF export |
| `/library` | Bullet + factory ammo library browser |
| `/account` | Profile, units, data export, delete account |
| `/admin` | Admin-only: data review queue, field-data progress toward reveal threshold, flags |
| `/legal/terms`, `/legal/privacy`, `/legal/disclaimer` | Placeholder copy, clearly marked DRAFT |

### 6.2 Calculator UX
- Three collapsible input groups: **Bullet/Load** (pick from library or custom: diameter, weight, BC G1/G7, length, MV), **Rifle** (sight height, twist + direction, zero range, click values, suppressor), **Conditions** (temp, pressure type, altitude, RH, wind, incline, latitude/azimuth if Coriolis on).
- "Use my location for altitude/conditions" is **opt-in** and never stored at full precision (see §10).
- Output: sticky table with configurable range start/end/step; tabs for Drop, Velocity, Energy, Wind charts. Transonic rows visually flagged.
- Compare mode: overlay up to 3 loads on the same chart (e.g. 6.5 CM vs .308 vs 300 PRC).
- Every output that depends on unverified library data shows the badge.
- Guest mode: profiles saved to localStorage, prompt "Create a free account to sync and contribute to the Field Database."
- Performance: full 0–1,500 yd solve in < 50 ms on a mid phone; run the solver in a Web Worker if needed.

---

## 7. Phase 3 — Data Model & Supabase

Write migrations, RLS policies, and typed client. Use UUID PKs, `created_at/updated_at`, soft deletes where noted.

### 7.1 Reference data (public read, admin write)
- `manufacturers` (id, name, type: bullet|ammo|suppressor|rifle, website)
- `cartridges` (id, name e.g. "6.5 Creedmoor", bullet_diameter_in, saami_max_pressure_psi nullable, source_url)
- `bullets` (id, manufacturer_id, name, diameter_in, weight_gr, length_in nullable, bc_g1, bc_g7 nullable, bc_bands jsonb nullable, source_url, verified bool, verified_at, notes)
- `factory_loads` (id, manufacturer_id, cartridge_id, bullet_id, product_name, sku nullable, advertised_mv_fps, test_barrel_in, source_url, verified)
- `suppressors` (id, manufacturer_id, model, mount_type enum, thread_pitch nullable, bore_diameter_in, max_rated_cartridge text, rated_cartridges text[], length_in, weight_oz, min_barrel_length_note text nullable, source_url, verified)
- `mount_types` enum: `direct_thread`, `hub_1375x24`, `asr`, `keymo`, `omega_qd`, `proprietary_qd`, `other`

### 7.2 User data (owner-only RLS)
- `profiles` (user_id, display_name, units_pref, role: user|admin, beta_cohort, contribution_opt_in bool default true)
- `rifles` (id, user_id, name, cartridge_id, barrel_length_in, twist_in, twist_dir, thread_pitch nullable, sight_height_in, zero_range, zero_conditions jsonb, click_elev, click_wind, notes) — **no serial numbers, ever.** Don't even provide the field.
- `loads` (id, rifle_id, bullet_id nullable, factory_load_id nullable, custom_bullet jsonb nullable, mv_fps, mv_temp_f, temp_sensitivity_fps_per_f nullable, trued_mv jsonb nullable, trued_bc jsonb nullable)
- `rifle_suppressors` (rifle_id, suppressor_id, measured_mv_delta_fps nullable, measured_poi_shift jsonb nullable)
- `sessions` (id, user_id, rifle_id, load_id, suppressor_id nullable, date, temp, pressure, pressure_type, altitude_ft, rh, region_coarse text nullable, chrono_type enum, notes, status: draft|submitted|flagged|excluded)
- `shot_strings` (id, session_id, suppressed bool, velocities_fps numeric[], first_round_cold bool)
- `drop_observations` (id, session_id, range_yd, observed_elev_correction, unit, observed_wind_correction nullable, wind_estimate jsonb, hit bool)
- `poi_shift_observations` (id, session_id, distance_yd, vertical_in, horizontal_in, group_size_in nullable)
- `entitlements` (user_id, tier: free|pro|founder, source, expires_at) — stub.
- `events` (id, user_id nullable, name, props jsonb, created_at) — minimal product analytics.

### 7.3 Aggregates (server-computed, read controlled by flag)
- `field_aggregates` (group_key, bullet_id/factory_load_id, barrel_length_bucket_in, suppressor_id nullable, n_shots, n_sessions, n_users, mv_mean, mv_sd_between_sessions, mv_ci95_low, mv_ci95_high, sd_mean_within_session, es_mean, normalized_temp_f, updated_at)
- `suppressor_deltas` (suppressor_id, cartridge_id, barrel_length_bucket_in, n_sessions, mv_delta_mean, mv_delta_sd, poi_vertical_mean, poi_horizontal_mean, ci fields, updated_at)
- `app_flags` (key, value jsonb) — includes `field_data_public` (false), `field_reveal_threshold_shots` (50000), `min_sessions_to_display` (5).

### 7.4 Seed data
- Loader script `scripts/seed.ts` reads CSVs from `supabase/seed/` and validates each row with Zod (diameter sane for cartridge, BC within plausible range 0.05–1.2 G1, weights sane, etc.). Rejects rows without `source_url`.
- **Bullets/BCs:** seed only from manufacturers' public spec pages (Hornady, Berger, Sierra, Nosler, Barnes). Start with ~40 popular match/hunting bullets across 6.5 CM, .308, .223/5.56, 6mm Creedmoor, .300 Win Mag, 300 PRC, 6.5 PRC, .224 Valkyrie, .338 Lapua. If you can't access a page during the build, add the row to a `to_verify.csv` instead of guessing, and list it in `NEEDS_CHAD.md`.
- **Factory loads:** ~30 popular loads with advertised MV + test barrel length (this is what makes the "factory vs field" story work).
- **Suppressors:** ~15 popular models with mount types and rated calibers from manufacturer pages. Same verify rule.
- **Do not scrape** paywalled or licensed sources (Applied Ballistics library, PEW Science reports, forum posts). PEW Science and manufacturers get *outbound links* only.
- Admin UI can edit/verify any reference row and records who verified it and when.

---

## 8. Phase 4 — Profiles, DOPE Cards, Range Mode

- Rifle → Loads → (optional) Suppressor hierarchy. Duplicate/archive profiles.
- **Temperature sensitivity:** if a load has temp sensitivity, adjust MV for current temp; show the adjustment.
- **DOPE card PDF** (`@react-pdf/renderer`):
  - Header: rifle, load, bullet/BC, MV (and trued MV if any), zero, sight height, click values, atmosphere used, date generated, suppressed/unsuppressed label.
  - Table: range (configurable step), elevation (MIL or MOA + clicks), wind hold for 5/10 mph full value, velocity, energy, TOF. Transonic rows shaded.
  - Formats: letter page, half-page, and **scope-cap/wrist card** compact size.
  - Option: print both suppressed and unsuppressed columns side by side.
  - Footer: "Ballistic Forge — verify with live fire" + generated timestamp.
- **Range mode** (`/range`): profile picker, distance stepper (±25 yd), wind clock + speed slider, suppressor toggle, giant elevation/wind readout, screen wake lock while open.

---

## 9. Phase 5 — The Can (Suppressor Module)

### 9.1 Suppressor toggle
On any rifle with an attached suppressor, a single toggle switches the solution between suppressed and unsuppressed. Resolution order for the adjustment:
1. User's own measured MV delta + POI shift (from their sessions) — label "Your data".
2. Community aggregate from `suppressor_deltas` — **only if** `field_data_public` is on and n ≥ threshold — label "Field data (n=…)".
3. Nothing — show "No delta yet. Log a suppressed vs unsuppressed string to calibrate." with a button to start that session type.
Never apply a generic made-up delta.

### 9.2 Compatibility checker (`/suppressors/compatibility`)
Inputs: rifle (cartridge, bore diameter, thread pitch, barrel length) + suppressor. Output a checklist with pass / warn / fail / unknown:
- Bore diameter vs suppressor bore / max rated cartridge (fail if bullet diameter ≥ suppressor bore; warn if close to max rating).
- Cartridge in manufacturer's rated list (pass), not listed but under max (warn — "verify with manufacturer"), over max (fail).
- Thread pitch vs mount: direct match, adapter needed (name the mount system, e.g. HUB 1.375×24 adapter), or incompatible.
- Manufacturer barrel-length notes (display verbatim note, flagged unknown if absent).
- Missing data always resolves to **unknown**, never pass.
- Prominent disclaimer: informational only; confirm with the suppressor manufacturer; the app is not a safety authority. Baffle-strike risk messaging is factual and short.

### 9.3 Suppressor pages
Spec sheet, mount type, rated cartridges, outbound links (manufacturer, PEW Science search if applicable), and — when public — field deltas by cartridge/barrel length. Sound (dB) data is **out of scope** for the pilot except as outbound links; note SAAMI's suppressor sound standard as a future data-structure consideration in `HANDOFF.md`.

---

## 10. Phase 6 — The Field (Shot Data Engine)

### 10.1 Logging flow (`/sessions/new`)
A fast, at-the-bench wizard:
1. Pick rifle + load (+ suppressor). Conditions pre-filled from last session; editable.
2. Chrono type: Garmin Xero, LabRadar, MagnetoSpeed, optical, other, none.
3. Add shot strings: paste or tap-enter velocities (number pad, one per line or comma-separated). Mark suppressed/unsuppressed, cold-bore first shot.
4. Optional: observed drop/elevation at ranges; POI shift for suppressor sessions.
5. Review → shows the session's mean, SD, ES instantly → Submit.
- Also: **CSV import** for Garmin Xero / LabRadar exports (implement parsers against their documented export formats; if you can't confirm a format, build a generic column-mapping importer and note it).
- Drafts autosave locally. Works offline; syncs when back online.

### 10.2 Aggregation (server-side)
Implement as a Supabase Edge Function or SQL function triggered on submit, plus a nightly full recompute (Vercel cron or Supabase scheduled function).
- **Group key:** (bullet_id or factory_load_id) × barrel length bucket (1-inch) × suppressor_id (nullable).
- Per session: mean, SD, ES of each string.
- Across sessions: treat **each session as one sample** (not each shot) to avoid one heavy user dominating. Also cap per-user weight (e.g. max 3 sessions per user per group count at full weight; configurable).
- **Temperature normalization:** if temp sensitivity is known for the load, normalize MV to 59 °F; otherwise store raw and record `normalized=false`.
- **Outlier handling:** plausibility gates first (MV within ±20% of advertised for the barrel length, velocities within chrono-plausible range, SD < 100 fps), then MAD-based exclusion across sessions (|x − median| > 3.5 × MAD scaled). Excluded sessions are kept and visible to the owner with a reason — never silently deleted.
- **Trust weighting (v1, simple & documented):** chrono type and string length affect weight; flagged accounts excluded. Write the formula in `DECISIONS.md`.
- **Confidence interval:** 95% CI on the mean using t-distribution over session means. Display only when n_sessions ≥ `min_sessions_to_display`.
- **Suppressor deltas:** only from sessions containing *both* suppressed and unsuppressed strings, same day, same rifle/load. Delta per session, then aggregate as above.
- **Barrel length curve (stretch):** for a given load, fit fps-per-inch across barrel buckets when ≥ 3 buckets have data. Display only behind admin flag in pilot.

### 10.3 Display
- **Always visible to the user:** their own per-load history (MV over time, SD/ES trends, temp vs MV scatter), and "Your shots in the Field Database: N".
- **Behind `field_data_public`:** next to calculator output and on library pages: `Field MV: 2,6xx fps ± SD · 95% CI [a–b] · n = sessions / users` vs `Factory: X fps (24" test barrel)`, with a delta badge. Low-n groups show "Not enough data yet".
- **Admin `/admin`:** total shots/sessions/users, progress bar to the reveal threshold, review queue for flagged sessions, per-group drill-down, flag toggles.

### 10.4 Privacy (non-negotiable)
- No serial numbers, no exact GPS. Region stored only as coarse text (state/province) if the user chooses; altitude stored as a number.
- Aggregates are anonymous; minimum n_users per displayed group = 3 (configurable) so no one's data is identifiable.
- User can export all their data (JSON + CSV) and delete their account; deletion removes their raw rows and triggers recompute.
- `contribution_opt_in` respected: opted-out users' data never enters aggregates.
- Privacy policy draft states all of this plainly.

---

## 11. Phase 7 — Library, Auth Polish, Entitlements Stub, Beta Readiness

- `/library`: search/filter bullets and factory loads by cartridge, weight, manufacturer, BC type; "Use in calculator" button; verified badges; "Suggest a correction" form → admin queue.
- Auth: magic link + Google; guest → account migration moves localStorage profiles into Supabase.
- **Entitlements stub:** define Free vs Pro feature lists in one config file. In pilot, all beta users get `founder` tier (everything on). Pro candidates: unlimited profiles, compare mode, scope-cap DOPE format, CSV import, truing, Coriolis/spin drift advanced panel. Gate via a `useEntitlement()` hook so payments can be wired later without refactor.
- Beta feedback: floating "Feedback" button → `feedback` table (page, message, screenshot optional via Supabase Storage).
- Onboarding: 3-step first-run (units → first rifle → first load) that ends on a real solution.
- Empty states everywhere that tell the user exactly what to do next.

---

## 12. Phase 8 — Quality, Hardening, Handoff

- Playwright smoke tests: guest calc solve; create account; create rifle/load; generate DOPE PDF; log a session; admin sees it; suppressor compatibility check.
- Accessibility: keyboard nav, labels on every input, contrast AA on dark theme.
- Error handling: engine input validation with human messages ("Sight height of 25 in looks wrong — did you mean 2.5?").
- Lighthouse mobile: performance ≥ 85, PWA installable.
- `.env.example` with every variable documented. README: local setup with Supabase CLI, seeding, running tests, deploying to Vercel.
- Security: RLS tested (write a test that user A cannot read user B's sessions), admin routes server-guarded, rate-limit session submission.
- Write `HANDOFF.md` (see §0.9).

---

## 13. Legal & Safety Scope (hard lines)

- **No reloading/powder-charge data or recommendations.** The app never suggests powder types, charge weights, or "pressure-safe" loads. Handloaders enter their own MV; any load-development UI points to published reloading manuals.
- No AI load advisor in the pilot (deferred; if ever built, it recommends *factory products and settings*, never charges).
- No features tied to evading laws, NFA paperwork advice, or legal guidance on suppressor ownership — link to ATF and manufacturer resources only.
- Disclaimer on every solution and DOPE card: calculations are estimates; verify with live fire; user is responsible for safe and legal firearm use.
- Terms/Privacy are DRAFT placeholders; log "attorney review" in `NEEDS_CHAD.md`.
- Scraped/seeded data respects robots.txt and site terms; prefer manual entry from public spec pages over scraping. No paywalled sources.

---

## 14. Out of Scope for the Pilot (note in HANDOFF as next steps)

- Native iOS/Android (Expo) — engine package must stay RN-compatible.
- RevenueCat/Stripe payments.
- Bluetooth chrono/Kestrel/rangefinder integrations.
- Multi-zone wind, 6DOF/custom drag models, aerodynamic-jump refinement.
- Reddit sentiment aggregation for suppressor/caliber reviews.
- Sound (dB) data module.
- Public field data reveal (built, but flag stays off).
- Manufacturer data partnerships.

---

## 15. Definition of Done (pilot)

- [ ] A guest can open the site on a phone, pick a 6.5 Creedmoor factory load, enter conditions, and get a full 0–1,200 yd solution in under 30 seconds.
- [ ] Engine passes all §5.8 tests; external reference test harness exists and skips cleanly until Chad fills fixtures.
- [ ] A logged-in user can create rifle → load → suppressor, toggle suppressed/unsuppressed, and print a DOPE card (3 formats).
- [ ] A user can log a session (manual or CSV), see their stats, and it lands in aggregates server-side.
- [ ] Field aggregates compute correctly with outlier handling, CI, user-weight caps — and are hidden from non-admins while the flag is off.
- [ ] Compatibility checker returns pass/warn/fail/unknown with reasons and never "pass" on missing data.
- [ ] Every seed row has a source and verified flag; unverified data is visibly badged.
- [ ] RLS verified by test. Data export + account deletion work.
- [ ] Deployed-ready to Vercel; README + `.env.example` complete.
- [ ] `HANDOFF.md` written honestly — including what's shaky.
