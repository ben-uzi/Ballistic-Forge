-- 0001 — Foundation: extensions, enums and shared helpers.
--
-- Conventions for every table that follows:
--   * uuid primary keys (gen_random_uuid())
--   * created_at / updated_at, with updated_at maintained by a trigger
--   * soft delete via archived_at where the brief calls for it
--   * row-level security is enabled in 0005; nothing is readable by default

-- No extensions required: gen_random_uuid() has been core Postgres since 13,
-- so the schema needs nothing beyond what every Supabase project ships with.

-- ── Enums ────────────────────────────────────────────────────────────────────

create type public.manufacturer_type as enum ('bullet', 'ammo', 'suppressor', 'rifle');

-- Mount standards a can attaches by. `other` is a real answer; never guess.
create type public.mount_type as enum (
  'direct_thread',
  'hub_1375x24',
  'asr',
  'keymo',
  'omega_qd',
  'proprietary_qd',
  'other'
);

create type public.twist_direction as enum ('right', 'left');

create type public.angular_unit as enum ('mil', 'moa', 'iphy');

create type public.pressure_type as enum ('station', 'baro');

create type public.mv_source as enum ('advertised', 'chronograph', 'trued', 'estimated');

create type public.chrono_type as enum (
  'garmin_xero',
  'labradar',
  'magnetospeed',
  'optical',
  'other',
  'unknown'
);

create type public.session_status as enum ('draft', 'submitted', 'flagged', 'excluded');

create type public.user_role as enum ('user', 'admin');

create type public.entitlement_tier as enum ('free', 'pro', 'founder');

create type public.correction_status as enum ('open', 'accepted', 'rejected');

-- ── Shared helpers ───────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at on every UPDATE.';
