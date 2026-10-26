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
- **Steps:** import the repo in Vercel (root: `apps/web`), add env vars from item 1, then add the
  domain under Project → Domains and set the DNS records Vercel shows at your registrar.

### 4. External reference trajectories

- **Why:** the only honest way to validate the engine against established solvers. Fixtures are left empty on purpose.
- **Steps:** run 5 loads (suggest: 6.5 CM 140 ELD-M, .308 175 SMK, 6mm CM 108 ELD-M, 300 PRC 225 ELD-M,
  .223 77 SMK) through JBM Ballistics and Hornady 4DOF at stated conditions. Paste inputs + outputs into
  `packages/engine/test/fixtures/reference_cases.json` (schema arrives in Phase 1).

### 5. Logo and brand assets

- **Why:** a placeholder SVG anvil/crosshair mark ships in Phase 2.
- **Steps:** drop final SVGs into `apps/web/public/brand/` with the same filenames.

### 6. Attorney review of legal copy

- **Why:** Terms, Privacy, and Disclaimer ship as clearly marked DRAFTs.
- **Steps:** have counsel review `/legal/*` pages before inviting beta testers.

### 7. Real chronograph export files

- **Why:** confirms the Garmin Xero and LabRadar CSV parsers against real data.
- **Steps:** export one session from each device and drop the files into `apps/web/test/fixtures/chrono/`.

## Resolved

_None yet._
