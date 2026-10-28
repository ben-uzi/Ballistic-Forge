-- 0003 — User-owned data. Every table carries user_id and is owner-only (policies in 0005).
--
-- Deliberately absent everywhere in this file: firearm serial numbers. There is
-- no column for one and there never will be (BUILD_BRIEF §7.2, §13).

-- ── Profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- The UnitPrefs shape the web app already uses.
  units_pref jsonb not null default '{}'::jsonb,
  role public.user_role not null default 'user',
  beta_cohort text,
  -- Opt-in by default, but the account page can switch it off and the
  -- aggregation job must honour it.
  contribution_opt_in boolean not null default true,
  -- Set by an admin when a user's submissions stop being trustworthy; excluded
  -- from aggregates without deleting their own view of their data.
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

/*
 * Give every new auth user a profile row.
 *
 * SECURITY DEFINER because the trigger fires as the authenticating role, which
 * has no rights on public.profiles.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Rifles ───────────────────────────────────────────────────────────────────

create table public.rifles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cartridge_id uuid references public.cartridges (id) on delete set null,
  -- Kept alongside cartridge_id so a rifle in a wildcat the library has never
  -- heard of is still a first-class profile.
  cartridge_name text,
  barrel_length_in numeric(5, 2),
  twist_in numeric(5, 2),
  twist_dir public.twist_direction not null default 'right',
  thread_pitch text,
  sight_height_in numeric(5, 3) not null,
  zero_range_yd numeric(6, 1) not null default 100,
  zero_conditions jsonb,
  click_elev text not null default 'mil_0_1',
  click_wind text not null default 'mil_0_1',
  angular_unit public.angular_unit not null default 'mil',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rifles_sight_height_sane check (sight_height_in between 0.1 and 10),
  constraint rifles_barrel_sane check (barrel_length_in is null or barrel_length_in between 4 and 40),
  constraint rifles_twist_sane check (twist_in is null or twist_in between 4 and 40),
  constraint rifles_zero_sane check (zero_range_yd between 10 and 1000)
);

create index rifles_user_idx on public.rifles (user_id) where archived_at is null;

create trigger rifles_set_updated_at
  before update on public.rifles
  for each row execute function public.set_updated_at();

-- ── Loads ────────────────────────────────────────────────────────────────────

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rifle_id uuid not null references public.rifles (id) on delete cascade,
  name text not null,
  bullet_id uuid references public.bullets (id) on delete set null,
  factory_load_id uuid references public.factory_loads (id) on delete set null,
  -- For a bullet that is not in the library: the same fields, entered by hand.
  custom_bullet jsonb,
  mv_fps numeric(7, 1) not null,
  mv_source public.mv_source not null default 'advertised',
  mv_temp_f numeric(5, 1),
  temp_sensitivity_fps_per_f numeric(6, 3),
  -- { value, at, at_range_yd, note } — the original mv_fps is never overwritten.
  trued_mv jsonb,
  trued_bc jsonb,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loads_mv_sane check (mv_fps between 300 and 5000),
  constraint loads_temp_sensitivity_sane check (
    temp_sensitivity_fps_per_f is null or temp_sensitivity_fps_per_f between -5 and 5
  ),
  -- A load has to describe its bullet somehow.
  constraint loads_identifies_a_bullet check (
    bullet_id is not null or factory_load_id is not null or custom_bullet is not null
  )
);

create index loads_rifle_idx on public.loads (rifle_id) where archived_at is null;
create index loads_user_idx on public.loads (user_id);

create trigger loads_set_updated_at
  before update on public.loads
  for each row execute function public.set_updated_at();

-- ── Rifle ↔ suppressor ───────────────────────────────────────────────────────

create table public.rifle_suppressors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rifle_id uuid not null references public.rifles (id) on delete cascade,
  suppressor_id uuid not null references public.suppressors (id) on delete restrict,
  -- The user's own measurements. Null means unknown, and the UI must say so
  -- rather than substituting a generic delta.
  measured_mv_delta_fps numeric(6, 1),
  measured_poi_shift jsonb,
  measured_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rifle_suppressors_unique unique (rifle_id, suppressor_id),
  constraint rifle_suppressors_delta_sane check (
    measured_mv_delta_fps is null or measured_mv_delta_fps between -200 and 200
  )
);

create trigger rifle_suppressors_set_updated_at
  before update on public.rifle_suppressors
  for each row execute function public.set_updated_at();

-- ── Sessions ─────────────────────────────────────────────────────────────────

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rifle_id uuid not null references public.rifles (id) on delete cascade,
  load_id uuid not null references public.loads (id) on delete cascade,
  suppressor_id uuid references public.suppressors (id) on delete set null,
  occurred_on date not null default current_date,
  temp_f numeric(5, 1),
  pressure numeric(8, 2),
  pressure_type public.pressure_type,
  altitude_ft numeric(7, 1),
  rh_percent numeric(5, 2),
  -- Coarse only: a state or region name, never coordinates (BUILD_BRIEF §10.4).
  region_coarse text,
  chrono_type public.chrono_type not null default 'unknown',
  status public.session_status not null default 'draft',
  -- Why a session was flagged or excluded; the owner can always see it.
  status_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_temp_sane check (temp_f is null or temp_f between -60 and 140),
  constraint sessions_rh_sane check (rh_percent is null or rh_percent between 0 and 100),
  constraint sessions_altitude_sane check (altitude_ft is null or altitude_ft between -1500 and 30000)
);

create index sessions_user_idx on public.sessions (user_id, occurred_on desc);
create index sessions_load_idx on public.sessions (load_id);
create index sessions_aggregation_idx on public.sessions (status, suppressor_id);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ── Shot strings ─────────────────────────────────────────────────────────────

create table public.shot_strings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  suppressed boolean not null default false,
  velocities_fps numeric(7, 1)[] not null,
  first_round_cold boolean not null default false,
  label text,
  -- Set by the aggregation job, with a reason the owner can read.
  excluded boolean not null default false,
  excluded_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- cardinality(), not array_length(): array_length of an empty array is
  -- NULL, and a NULL CHECK expression passes.
  constraint shot_strings_not_empty check (cardinality(velocities_fps) >= 1)
);

create index shot_strings_session_idx on public.shot_strings (session_id);

create trigger shot_strings_set_updated_at
  before update on public.shot_strings
  for each row execute function public.set_updated_at();

-- ── Observations ─────────────────────────────────────────────────────────────

create table public.drop_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  range_yd numeric(6, 1) not null,
  observed_elev_correction numeric(6, 2) not null,
  unit public.angular_unit not null default 'mil',
  observed_wind_correction numeric(6, 2),
  wind_estimate jsonb,
  hit boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drop_observations_range_sane check (range_yd between 25 and 3000)
);

create index drop_observations_session_idx on public.drop_observations (session_id);

create trigger drop_observations_set_updated_at
  before update on public.drop_observations
  for each row execute function public.set_updated_at();

create table public.poi_shift_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  distance_yd numeric(6, 1) not null,
  vertical_in numeric(6, 2) not null,
  horizontal_in numeric(6, 2) not null,
  group_size_in numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poi_distance_sane check (distance_yd between 25 and 1000)
);

create index poi_shift_session_idx on public.poi_shift_observations (session_id);

create trigger poi_shift_set_updated_at
  before update on public.poi_shift_observations
  for each row execute function public.set_updated_at();

-- ── Entitlements (payments are stubbed for the pilot) ────────────────────────

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier public.entitlement_tier not null default 'free',
  source text not null default 'pilot',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_one_per_user unique (user_id)
);

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ── Events (first-party analytics only) ──────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_name_idx on public.events (name, created_at desc);

comment on table public.events is
  'Minimal first-party analytics. No third-party trackers ship in the pilot (BUILD_BRIEF §2).';
