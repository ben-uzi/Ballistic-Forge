import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `supabase/migrations`, resolved relative to this file rather than the cwd. */
export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../supabase/migrations/', import.meta.url),
);

/** `supabase/seed`, where the CSVs and the generated seed.sql live. */
export const SEED_DIR = fileURLToPath(new URL('../../../supabase/seed/', import.meta.url));

/** Where the bundled offline library lands in the web app. */
export const LIBRARY_PATH = fileURLToPath(
  new URL('../../../apps/web/src/lib/library/bullets.json', import.meta.url),
);

export interface Migration {
  readonly name: string;
  readonly sql: string;
}

/**
 * Every migration, in filename order.
 *
 * Filenames are zero-padded (`0001_…`) so lexical order is apply order; the
 * check below makes a mis-numbered file a loud failure rather than a schema
 * that applies in the wrong sequence.
 */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  files.forEach((name, index) => {
    const expected = String(index + 1).padStart(4, '0');
    if (!name.startsWith(`${expected}_`)) {
      throw new Error(
        `Migration ${name} is out of sequence: expected a file starting with "${expected}_".`,
      );
    }
  });

  return files.map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}
