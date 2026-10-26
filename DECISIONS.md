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
