import { PGlite } from '@electric-sql/pglite';
import { loadMigrations } from '../src/migrations.ts';

/**
 * An in-process Postgres with the real migrations applied.
 *
 * The brief expected the RLS test to skip without a local Supabase. PGlite is
 * actual Postgres compiled to WASM, so instead of skipping we apply the real
 * migration files and exercise the real policies on every run.
 *
 * What Supabase provides and we therefore have to stand up first: the `auth`
 * schema with a `users` table, `auth.uid()` reading the request's JWT claim,
 * and the `anon` / `authenticated` / `service_role` roles the policies grant to.
 * Nothing else is faked — the policies, triggers and constraints under test are
 * the ones that will run in production.
 */
const AUTH_SHIM = `
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$$;

do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$$;

do $$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
`;

export interface TestDb {
  readonly db: PGlite;
  /** Run `fn` as a signed-in user, then drop back to the owner role. */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>;
  /** Run `fn` as an unauthenticated visitor. */
  asAnon<T>(fn: () => Promise<T>): Promise<T>;
  /** Create an auth user (which fires the profile trigger) and return its id. */
  createUser(email: string): Promise<string>;
  makeAdmin(userId: string): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();
  await db.exec(AUTH_SHIM);

  for (const migration of loadMigrations()) {
    try {
      await db.exec(migration.sql);
    } catch (error) {
      throw new Error(
        `Migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  const withRole = async <T>(role: string, userId: string | null, fn: () => Promise<T>) => {
    await db.exec(`set role ${role};`);
    await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userId ?? '']);
    try {
      return await fn();
    } finally {
      await db.exec('reset role;');
      await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', '']);
    }
  };

  return {
    db,
    asUser: (userId, fn) => withRole('authenticated', userId, fn),
    asAnon: (fn) => withRole('anon', null, fn),
    async createUser(email) {
      const result = await db.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      );
      const id = result.rows[0]?.id;
      if (id === undefined) throw new Error('Failed to create the test user');
      return id;
    },
    async makeAdmin(userId) {
      await db.query('update public.profiles set role = $1 where user_id = $2', ['admin', userId]);
    },
    close: () => db.close(),
  };
}

/** A rifle → load → session chain owned by `userId`, for the RLS tests. */
export async function seedUserData(
  { db }: TestDb,
  userId: string,
  name: string,
): Promise<{ rifleId: string; loadId: string; sessionId: string }> {
  const rifle = await db.query<{ id: string }>(
    `insert into public.rifles (user_id, name, sight_height_in, zero_range_yd)
     values ($1, $2, 1.9, 100) returning id`,
    [userId, `${name} rifle`],
  );
  const rifleId = rifle.rows[0]?.id ?? '';

  const load = await db.query<{ id: string }>(
    `insert into public.loads (user_id, rifle_id, name, custom_bullet, mv_fps)
     values ($1, $2, $3, '{"name":"140 ELD-M"}'::jsonb, 2690) returning id`,
    [userId, rifleId, `${name} load`],
  );
  const loadId = load.rows[0]?.id ?? '';

  const session = await db.query<{ id: string }>(
    `insert into public.sessions (user_id, rifle_id, load_id, status)
     values ($1, $2, $3, 'submitted') returning id`,
    [userId, rifleId, loadId],
  );
  const sessionId = session.rows[0]?.id ?? '';

  await db.query(
    `insert into public.shot_strings (user_id, session_id, velocities_fps)
     values ($1, $2, $3)`,
    [userId, sessionId, '{2690,2695,2688}'],
  );

  return { rifleId, loadId, sessionId };
}
