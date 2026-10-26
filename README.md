# Ballistic Forge

_Built in the Lab. Proven in the Field._

Brand-agnostic precision ballistics platform: a point-mass solver, a suppressor module, and a
crowdsourced field-data engine. Spec: [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md). Progress: [`PLAN.md`](PLAN.md).

## Layout

| Path              | What                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `packages/engine` | `@bf/engine` — pure TypeScript ballistics engine (no deps, no DOM) |
| `apps/web`        | Next.js web app (Phase 2)                                          |
| `supabase/`       | Migrations and seed CSVs (Phase 3)                                 |
| `scripts/`        | Data import / validation scripts                                   |

## Local setup

Requires Node ≥ 22.12 (24 recommended, see `.nvmrc`) and pnpm 12.

```sh
npm install -g pnpm   # if pnpm isn't installed
pnpm install
pnpm gate             # typecheck + lint + test (the phase gate)
```

Other scripts: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## Tracking docs

- [`PLAN.md`](PLAN.md) — phase checklists
- [`DECISIONS.md`](DECISIONS.md) — judgement calls and how to reverse them
- [`NEEDS_CHAD.md`](NEEDS_CHAD.md) — blockers needing the founder
- [`HANDOFF.md`](HANDOFF.md) — final state (end of build)
