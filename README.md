# Ballistic Forge

_Built in the Lab. Proven in the Field._

A brand-agnostic precision ballistics platform: a point-mass solver, a suppressor module, and a
crowdsourced field-data engine. Spec: [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md).
Progress: [`PLAN.md`](PLAN.md). Current state: [`HANDOFF.md`](HANDOFF.md).

**It runs with no configuration at all.** With no `.env.local` the app is in _demo mode_: the
calculator, profiles, DOPE cards, range mode, the suppressor module and session logging all work,
with everything stored in the browser. Accounts and sync need a Supabase project
([`NEEDS_CHAD.md`](NEEDS_CHAD.md) item 1).

## Quick start

Requires Node ≥ 22.12 (24 recommended, see `.nvmrc`) and pnpm 12.

```sh
npm install -g pnpm        # if pnpm isn't installed
pnpm install
pnpm dev                   # http://localhost:3000
```

Then open `/calc`. It solves on load — no setup, no account.

## Layout

| Path              | What                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine` | `@bf/engine` — the ballistics engine. Pure TypeScript, zero runtime deps, no DOM or Node APIs, so React Native can reuse it unchanged. |
| `packages/db`     | `@bf/db` — database types, shared Zod schemas, the seed pipeline, the Field aggregation core and the chronograph CSV importer.         |
| `apps/web`        | The Next.js app.                                                                                                                       |
| `supabase/`       | Migrations and seed CSVs.                                                                                                              |
| `scripts/`        | Build-time utilities (`gen-icons.mjs`).                                                                                                |

## Scripts

| Command                     | What it does                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                  | Run the web app                                                               |
| `pnpm gate`                 | `typecheck && lint && test` — the bar every phase has to clear                |
| `pnpm test`                 | Unit tests across all packages                                                |
| `pnpm --filter @bf/web e2e` | Playwright smoke tests against a production build                             |
| `pnpm seed`                 | Validate `supabase/seed/*.csv`, regenerate `seed.sql` and the bundled library |
| `pnpm format`               | Prettier                                                                      |

## Tests

```sh
pnpm gate                          # 489 unit tests, lint, typecheck
pnpm --filter @bf/web e2e          # 34 end-to-end tests, desktop + mobile
```

The database tests need **no Docker and no Supabase project**. They apply the real migrations to
[PGlite](https://pglite.dev) — Postgres compiled to WebAssembly — and exercise the real row-level
security policies, so "user A cannot read user B's sessions" is verified on every run rather than
skipped.

The engine's performance test runs in a separate, uninstrumented pass, because coverage
instrumentation slows the solver enough to make the timing assertion meaningless.

## The database

The schema is five ordered plain-SQL migrations in `supabase/migrations`. To bring up a local
Supabase:

```sh
npx supabase init          # once, if supabase/config.toml does not exist
npx supabase start
npx supabase db reset      # applies migrations, then supabase/seed/seed.sql
```

Then copy the printed URL and anon key into `apps/web/.env.local` (see
`apps/web/.env.example` for every variable and what it does).

### Seeding

Reference data lives in `supabase/seed/*.csv`, one row per bullet, cartridge, factory load or
suppressor, each with the manufacturer URL it was transcribed from. `pnpm seed`:

1. validates every row with Zod — a row without a real `source_url` is rejected, as is a bullet
   whose diameter contradicts its cartridge;
2. writes idempotent SQL to `supabase/seed/seed.sql`;
3. writes `apps/web/src/lib/library/bullets.json`, which is what the in-app library reads, so the
   library works offline and cannot drift from the database;
4. writes anything it rejected to `supabase/seed/to_verify.csv` for a human.

Nothing is ever guessed. If a value cannot be sourced it does not ship.

## Deploying to Vercel

Import the repository and set:

| Setting          | Value                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Root directory   | `apps/web`                                                                                    |
| Framework preset | Next.js                                                                                       |
| Install command  | `pnpm install` run at the workspace root (Vercel does this automatically for pnpm workspaces) |
| Build command    | default (`next build`)                                                                        |
| Environment      | none required for demo mode; see `apps/web/.env.example`                                      |

The pilot ships `noindex` in its root metadata. Remove `robots` from `apps/web/src/app/layout.tsx`
before a public launch.

## Hard lines

These are product constraints, not preferences, and the code enforces them:

- **No reloading data.** No powder types, no charge weights, no pressure guidance anywhere.
- **No serial numbers.** There is no column and no field, and a test greps the schema to keep it
  that way.
- **No fabricated data.** Every reference row carries a source URL; nothing is marked verified
  until a human checks it.
- **No precise location.** The optional location button reads latitude only, rounds it to 0.1°, and
  never stores or transmits it.
- **Missing data is never a pass.** The suppressor compatibility checker answers "unknown" rather
  than guessing, and community aggregates stay hidden until enough shooters agree — enforced by
  row-level security, not by the interface.

## Tracking docs

- [`PLAN.md`](PLAN.md) — phase checklists, with what was deferred and why
- [`DECISIONS.md`](DECISIONS.md) — every judgement call, the reason, and how to reverse it
- [`NEEDS_CHAD.md`](NEEDS_CHAD.md) — what the build could not do for itself
- [`HANDOFF.md`](HANDOFF.md) — current state, limitations, and what to do next
