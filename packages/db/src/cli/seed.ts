/**
 * Seed loader: validate `supabase/seed/*.csv` and generate `supabase/seed/seed.sql`.
 *
 *   pnpm seed              validate and write seed.sql
 *   pnpm seed --check      validate only; write nothing (used by CI)
 *
 * Rows that fail validation, or reference something missing from the other
 * CSVs, are written to `supabase/seed/to_verify.csv` for a human to resolve —
 * never guessed, never silently dropped (BUILD_BRIEF §7.4).
 *
 * Runs under Node's native TypeScript stripping, so relative imports carry
 * their real `.ts` extensions.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv, toCsv, type CsvRow } from '../csv.ts';
import { SEED_DIR } from '../migrations.ts';
import { SEED_ORDER, type SeedFile } from '../schemas.ts';
import { buildSeed, toVerifyRows, type SeedInput } from '../seed.ts';

const checkOnly = process.argv.includes('--check');

const collected: Partial<Record<SeedFile, CsvRow[]>> = {};
const missing: SeedFile[] = [];

for (const file of SEED_ORDER) {
  const path = join(SEED_DIR, `${file}.csv`);
  if (!existsSync(path)) {
    missing.push(file);
    continue;
  }
  collected[file] = parseCsv(readFileSync(path, 'utf8'));
}

const result = buildSeed(collected satisfies SeedInput);

for (const file of SEED_ORDER) {
  const count = result.accepted[file];
  const label = missing.includes(file) ? 'no file' : `${String(count)} rows`;
  console.log(`  ${file.padEnd(16)} ${label}`);
}

if (result.rejected.length > 0) {
  console.log(`\n  ${String(result.rejected.length)} row(s) rejected:`);
  for (const issue of result.rejected.slice(0, 20)) {
    console.log(`    ${issue.file}:${String(issue.row)}  ${issue.message}`);
  }
  if (result.rejected.length > 20) {
    console.log(`    … and ${String(result.rejected.length - 20)} more`);
  }
}

if (checkOnly) {
  process.exit(result.rejected.length > 0 ? 1 : 0);
}

writeFileSync(join(SEED_DIR, 'seed.sql'), result.sql, 'utf8');
console.log(`\n  wrote ${join(SEED_DIR, 'seed.sql')}`);

if (result.rejected.length > 0) {
  const rows = toVerifyRows(result.rejected);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  writeFileSync(join(SEED_DIR, 'to_verify.csv'), toCsv(columns, rows), 'utf8');
  console.log(`  wrote ${join(SEED_DIR, 'to_verify.csv')} — needs a human (see NEEDS_CHAD.md)`);
}
