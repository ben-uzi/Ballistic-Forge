# Needs Chad

Things the build can't finish on its own. Each item: what's needed, why, and exact steps. The app is
built to work around every item here (demo mode, mocks, flags) until it's resolved.

## Open

### 1. Supabase project

- **Why:** accounts, sync, Field data, admin. Until then the app runs in guest/demo mode (localStorage).
- **Steps:** create a free project at https://supabase.com → Project Settings → API → copy the
  Project URL, `anon` key, and `service_role` key into `apps/web/.env.local` (template arrives in
  `.env.example`). Never commit the service role key.

### 2. Google OAuth credentials

- **Why:** Google sign-in (magic link works without it).
- **Steps:** Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Add the
  Supabase callback URL shown in Supabase → Authentication → Providers → Google. Paste client ID/secret there.

### 3. Vercel project + BallisticsMD.com DNS

- **Why:** deployment.
- **Steps:** create the project against this repo with **root directory `apps/web`**; the build
  command is the default (`next build`) and the install command must run at the workspace root so
  pnpm links `@bf/engine`. Add the env vars from item 1 (none are required for demo mode). Then
  Project → Domains → add `ballisticsmd.com` and create the records Vercel shows at your registrar.
  Until the domain is attached the app lives on its `*.vercel.app` URL.

### 4. External reference trajectories

- **Why:** the only honest way to validate the engine against established solvers. Fixtures are left empty on purpose.
- **Steps:** run 5 loads (suggest: 6.5 CM 140 ELD-M, .308 175 SMK, 6mm CM 108 ELD-M, 300 PRC 225 ELD-M,
  .223 77 SMK) through JBM Ballistics and Hornady 4DOF at stated conditions. Paste inputs + outputs into
  `packages/engine/test/fixtures/reference_cases.json` (schema arrives in Phase 1).

### 4a. Verify the G1/G7 drag tables (15 minutes)

- **Why:** `packages/engine/src/dragTables.ts` holds the standard G1 and G7 Mach→Cd tables. They
  were transcribed during the build, not copied from a downloaded file. A single wrong digit would
  bias every solution.
- **Steps:** download JBM's drag function files
  (https://www.jbmballistics.com/ballistics/downloads/downloads.shtml) or open py-ballisticcalc's
  `drag_tables.py` on GitHub, and compare every row. Fix any mismatch and run `pnpm test`. The
  reference cases (item 4) will also catch table errors.

### 4b. Verify the aerodynamic jump formula before turning it on

- **Why:** aerodynamic jump is implemented (Litz: `0.01·Sg − 0.0024·L + 0.032` MOA per mph of
  crosswind; RH twist + wind from the right → impact up) but **off by default**. The coefficients
  and sign were written from memory of _Applied Ballistics for Long Range Shooting_.
- **Steps:** check the formula and sign against the book (chapter on aerodynamic jump). If correct,
  note it here; if not, fix `litzAerodynamicJumpRad` in `spinDrift.ts`.

### 5. Logo and brand assets

- **Why:** a placeholder scope-reticle mark ships in Phase 2 (an anvil silhouette reads as a bowtie
  at favicon size, so the reticle was chosen instead — see DECISIONS).
- **Steps:** replace `apps/web/public/brand/logo.svg` and `wordmark.svg`, the inline mark in
  `apps/web/src/components/shell/logo.tsx`, and `apps/web/src/app/icon.svg`. For the PWA icons,
  either overwrite `apps/web/public/icons/*.png` directly or point
  `scripts/gen-icons.mjs` at the final artwork and re-run `node scripts/gen-icons.mjs`.

### 6. Attorney review of legal copy

- **Why:** Terms, Privacy, and Disclaimer ship as clearly marked DRAFTs.
- **Steps:** have counsel review `/legal/*` pages before inviting beta testers.

### 7. Real chronograph export files

- **Why:** confirms the Garmin Xero and LabRadar CSV parsers against real data.
- **Steps:** export one session from each device and drop the files into `apps/web/test/fixtures/chrono/`.

### 8. Factory load data (~29 rows still needed)

- **Why:** the factory-vs-field comparison is one of the three pillars, and it needs advertised
  muzzle velocity _with the test barrel length_ for each load. Only one row is seeded so far
  (Hornady 6.5 Creedmoor 140 gr ELD Match, 2,710 fps from a 24 in barrel, SKU 81500).
- **Why it stopped there:** each load needs its own product page transcribed; there is no single
  published table covering them, and guessing is a hard line.
- **Steps:** for each load, open the manufacturer's ammunition page, and add a row to
  `supabase/seed/factory_loads.csv` with `advertised_mv_fps`, `test_barrel_in` and the page URL as
  `source_url`. The cartridge must already exist in `cartridges.csv`. Then run `pnpm seed`; it
  validates every row and will reject anything inconsistent (for example a bullet diameter that
  does not match its cartridge).

### 9. Suppressor data (~15 rows needed)

- **Why:** The Can — the compatibility checker and the suppressor pages — has no data at all.
  `supabase/seed/suppressors.csv` currently holds only its header.
- **Why it stopped there:** suppressor manufacturer sites refuse automated requests
  (deadairsilencers.com returned 404, silencerco.com returned 403), so nothing could be sourced.
  Per the brief, nothing was invented in their place.
- **Steps:** for each model, from the manufacturer's own spec page, fill in `mount_type`
  (`direct_thread`, `hub_1375x24`, `asr`, `keymo`, `omega_qd`, `proprietary_qd`, `other`),
  `thread_pitch`, `bore_diameter_in`, `max_rated_cartridge`, `rated_cartridges`
  (semicolon-separated), `length_in`, `diameter_in`, `weight_oz`, and `min_barrel_length_note`
  **quoted verbatim**. Leave anything the page does not state blank — the checker is built to
  answer "unknown", and a blank is safer than a guess. Then run `pnpm seed`.

### 10. Cartridge reference data (~9 rows needed)

- **Why:** only 6.5 Creedmoor is seeded, and factory loads cannot be added for a cartridge that is
  not in the table.
- **Steps:** add rows to `supabase/seed/cartridges.csv` for .223 Rem, .308 Win, 6mm Creedmoor,
  6.5 PRC, .300 Win Mag, 300 PRC, 7mm PRC, .338 Lapua and .224 Valkyrie, each with
  `bullet_diameter_in` and a `source_url`. SAAMI's Z299.4 standard is the authoritative source for
  maximum average pressure (the `saami_max_pressure_psi` column, optional) — it is a large PDF and
  was not transcribed during the build.

## Resolved

- **Local database for testing** — resolved without needing anything from you. The RLS and schema
  tests run against PGlite, a real Postgres compiled to WebAssembly, so `pnpm test` exercises the
  actual migrations and policies with no Docker and no Supabase project.
