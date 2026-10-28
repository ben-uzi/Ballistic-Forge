import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './helpers.ts';
import { loadMigrations } from '../src/migrations.ts';
import { DEFAULTED_COLUMNS, OWNER_ONLY_TABLES, TABLES } from '../src/types.ts';

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
}, 60_000);

afterAll(async () => {
  // beforeAll can fail before `test` is assigned; don't mask that error.
  await test?.close();
});

describe('migrations', () => {
  it('are numbered in sequence', () => {
    const names = loadMigrations().map((m) => m.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort());
  });

  it('apply cleanly to a real Postgres', async () => {
    const { rows } = await test.db.query<{ count: number }>(
      `select count(*)::int as count from information_schema.tables where table_schema = 'public'`,
    );
    expect(rows[0]?.count).toBe(TABLES.length);
  });

  it('create exactly the tables the TypeScript types describe', async () => {
    const { rows } = await test.db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    const live = rows.map((row) => row.table_name);
    expect(live).toEqual([...TABLES].sort());
  });

  it('enable row-level security on every table', async () => {
    const { rows } = await test.db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public' and rowsecurity = false
       order by tablename`,
    );
    expect(rows.map((row) => row.tablename)).toEqual([]);
  });

  it('give every table at least one policy', async () => {
    const { rows } = await test.db.query<{ tablename: string }>(
      `select t.tablename from pg_tables t
       where t.schemaname = 'public'
         and not exists (
           select 1 from pg_policies p
           where p.schemaname = 'public' and p.tablename = t.tablename
         )`,
    );
    expect(rows.map((row) => row.tablename)).toEqual([]);
  });

  it('maintain updated_at with a trigger wherever the column exists', async () => {
    const { rows } = await test.db.query<{ table_name: string }>(
      `select c.table_name
       from information_schema.columns c
       where c.table_schema = 'public' and c.column_name = 'updated_at'
         and not exists (
           select 1 from information_schema.triggers t
           where t.event_object_schema = 'public'
             and t.event_object_table = c.table_name
             and t.action_timing = 'BEFORE'
             and t.event_manipulation = 'UPDATE'
         )
       order by c.table_name`,
    );
    // The aggregate tables are written only by the server-side job, which sets
    // updated_at explicitly; everything else gets the trigger.
    expect(rows.map((row) => row.table_name)).toEqual(['field_aggregates', 'suppressor_deltas']);
  });
});

describe('DEFAULTED_COLUMNS', () => {
  it('names only columns that really do have a database default', async () => {
    const { rows } = await test.db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and column_name = any($1)
         and column_default is null
       order by table_name, column_name`,
      [`{${DEFAULTED_COLUMNS.join(',')}}`],
    );
    // A name here without a default would make that column wrongly optional on
    // insert, and Postgres would reject the row at runtime instead.
    expect(rows).toEqual([]);
  });

  it('covers every not-null column that has a default', async () => {
    const { rows } = await test.db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and column_default is not null
         and is_nullable = 'NO'
         and not (column_name = any($1))
       order by table_name, column_name`,
      [`{${DEFAULTED_COLUMNS.join(',')}}`],
    );
    // Anything listed here is required on insert by the types but optional in
    // the database — add it to DEFAULTED_COLUMNS.
    expect(rows).toEqual([]);
  });
});

describe('the no-serial-numbers rule', () => {
  it('has no column anywhere that could hold one', async () => {
    const { rows } = await test.db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and (column_name ilike '%serial%' or column_name ilike '%sn%'
              or column_name ilike '%registration%')`,
    );
    expect(rows).toEqual([]);
  });
});

describe('owner-only tables', () => {
  it('all carry a user_id that cascades when the account is deleted', async () => {
    for (const table of OWNER_ONLY_TABLES) {
      const { rows } = await test.db.query<{ delete_rule: string }>(
        `select rc.delete_rule
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = tc.constraint_name
         join information_schema.referential_constraints rc
           on rc.constraint_name = tc.constraint_name
         where tc.table_schema = 'public' and tc.table_name = $1
           and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'user_id'`,
        [table],
      );
      expect(rows[0]?.delete_rule, `${table}.user_id`).toBe('CASCADE');
    }
  });
});

describe('constraints actually bite', () => {
  it('rejects a reference row with no source_url', async () => {
    await expect(
      test.db.query(
        `insert into public.cartridges (name, bullet_diameter_in) values ('No Source', 0.264)`,
      ),
    ).rejects.toThrow(/source_url/i);
  });

  it('rejects a bullet with no ballistic coefficient at all', async () => {
    await test.db.query(
      `insert into public.manufacturers (name, type) values ('Test Co', 'bullet')`,
    );
    await expect(
      test.db.query(
        `insert into public.bullets (manufacturer_id, name, diameter_in, weight_gr, source_url)
         select id, 'No BC', 0.264, 140, 'https://example.com/spec'
         from public.manufacturers where name = 'Test Co'`,
      ),
    ).rejects.toThrow(/bullets_has_a_bc/);
  });

  it('rejects an out-of-range ballistic coefficient', async () => {
    await expect(
      test.db.query(
        `insert into public.bullets (manufacturer_id, name, diameter_in, weight_gr, bc_g1, source_url)
         select id, 'Silly BC', 0.264, 140, 9.9, 'https://example.com/spec'
         from public.manufacturers where name = 'Test Co'`,
      ),
    ).rejects.toThrow(/bullets_bc_g1_sane/);
  });

  it('rejects a load that names no bullet at all', async () => {
    const user = await test.createUser('constraints@example.com');
    const rifle = await test.db.query<{ id: string }>(
      `insert into public.rifles (user_id, name, sight_height_in, zero_range_yd)
       values ($1, 'R', 1.9, 100) returning id`,
      [user],
    );
    await expect(
      test.db.query(
        `insert into public.loads (user_id, rifle_id, name, mv_fps) values ($1, $2, 'L', 2690)`,
        [user, rifle.rows[0]?.id],
      ),
    ).rejects.toThrow(/loads_identifies_a_bullet/);
  });

  it('rejects an empty shot string', async () => {
    const user = await test.createUser('emptystring@example.com');
    const { sessionId } = await (await import('./helpers.ts')).seedUserData(test, user, 'empty');
    await expect(
      test.db.query(
        `insert into public.shot_strings (user_id, session_id, velocities_fps)
         values ($1, $2, '{}')`,
        [user, sessionId],
      ),
    ).rejects.toThrow(/shot_strings_not_empty/);
  });
});

describe('feature flags', () => {
  it('ship with the field reveal switched off', async () => {
    const { rows } = await test.db.query<{ key: string; value: unknown }>(
      `select key, value from public.app_flags order by key`,
    );
    const flags = new Map(rows.map((row) => [row.key, row.value]));
    expect(flags.get('field_data_public')).toBe(false);
    expect(flags.get('field_reveal_threshold_shots')).toBe(50_000);
    expect(flags.get('min_sessions_to_display')).toBe(5);
    expect(flags.get('min_users_to_display')).toBe(3);
  });
});

describe('new accounts', () => {
  it('get a profile automatically', async () => {
    const userId = await test.createUser('autoprofile@example.com');
    const { rows } = await test.db.query<{ role: string; contribution_opt_in: boolean }>(
      `select role, contribution_opt_in from public.profiles where user_id = $1`,
      [userId],
    );
    expect(rows[0]?.role).toBe('user');
    expect(rows[0]?.contribution_opt_in).toBe(true);
  });
});
