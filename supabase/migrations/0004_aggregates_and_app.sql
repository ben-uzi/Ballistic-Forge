-- 0004 — Server-computed aggregates, feature flags, and the small app tables.

-- ── Field aggregates ─────────────────────────────────────────────────────────

create table public.field_aggregates (
  id uuid primary key default gen_random_uuid(),
  -- bullet|factory_load id × 1 inch barrel bucket × suppressor, as one string.
  group_key text not null unique,
  bullet_id uuid references public.bullets (id) on delete cascade,
  factory_load_id uuid references public.factory_loads (id) on delete cascade,
  barrel_length_bucket_in integer,
  suppressor_id uuid references public.suppressors (id) on delete cascade,
  n_shots integer not null default 0,
  n_sessions integer not null default 0,
  n_users integer not null default 0,
  mv_mean numeric(8, 2),
  mv_sd_between_sessions numeric(8, 2),
  mv_ci95_low numeric(8, 2),
  mv_ci95_high numeric(8, 2),
  sd_mean_within_session numeric(8, 2),
  es_mean numeric(8, 2),
  -- The temperature velocities were normalised to, or null when the group had
  -- no usable powder-temperature sensitivity and normalisation was skipped.
  normalized_temp_f numeric(5, 1),
  updated_at timestamptz not null default now(),
  constraint field_aggregates_identifies_a_load check (
    bullet_id is not null or factory_load_id is not null
  ),
  constraint field_aggregates_counts_sane check (
    n_shots >= 0 and n_sessions >= 0 and n_users >= 0
  )
);

create index field_aggregates_bullet_idx on public.field_aggregates (bullet_id);
create index field_aggregates_factory_load_idx on public.field_aggregates (factory_load_id);

comment on table public.field_aggregates is
  'Recomputed server-side on submit and nightly. Readable by non-admins only once app_flags.field_data_public is true.';

-- ── Suppressor deltas ────────────────────────────────────────────────────────

create table public.suppressor_deltas (
  id uuid primary key default gen_random_uuid(),
  suppressor_id uuid not null references public.suppressors (id) on delete cascade,
  cartridge_id uuid references public.cartridges (id) on delete cascade,
  barrel_length_bucket_in integer,
  n_sessions integer not null default 0,
  n_users integer not null default 0,
  mv_delta_mean numeric(7, 2),
  mv_delta_sd numeric(7, 2),
  mv_delta_ci95_low numeric(7, 2),
  mv_delta_ci95_high numeric(7, 2),
  poi_vertical_mean numeric(6, 2),
  poi_horizontal_mean numeric(6, 2),
  updated_at timestamptz not null default now(),
  constraint suppressor_deltas_unique unique (suppressor_id, cartridge_id, barrel_length_bucket_in)
);

comment on table public.suppressor_deltas is
  'Paired same-session suppressed/unsuppressed strings only. Never a generic delta.';

-- ── Feature flags ────────────────────────────────────────────────────────────

create table public.app_flags (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create trigger app_flags_set_updated_at
  before update on public.app_flags
  for each row execute function public.set_updated_at();

insert into public.app_flags (key, value, description) values
  ('field_data_public', 'false'::jsonb,
   'Master switch for the public Field view. Stays false until the reveal threshold is passed.'),
  ('field_reveal_threshold_shots', '50000'::jsonb,
   'Logged shots before the public Field view is considered.'),
  ('min_sessions_to_display', '5'::jsonb,
   'Minimum sessions in a group before an aggregate may be displayed.'),
  ('min_users_to_display', '3'::jsonb,
   'Minimum distinct users in a group before an aggregate may be displayed.'),
  ('barrel_curve_enabled', 'false'::jsonb,
   'Admin-only stretch feature: fps-per-inch barrel length curve.');

-- ── Waitlist, feedback, corrections ──────────────────────────────────────────

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint waitlist_email_shape check (email like '%_@_%._%')
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  url text,
  -- Path in Supabase Storage, when the user attached a screenshot.
  screenshot_path text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint feedback_message_not_empty check (length(btrim(message)) > 0)
);

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  -- Which reference row is wrong, and what it should say instead.
  table_name text not null,
  row_id uuid not null,
  field_name text not null,
  suggested_value text not null,
  source_url text,
  reason text,
  status public.correction_status not null default 'open',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint corrections_table_allowed check (
    table_name in ('bullets', 'factory_loads', 'suppressors', 'cartridges', 'manufacturers')
  )
);

create index corrections_open_idx on public.corrections (status, created_at desc);

comment on table public.corrections is
  'User-suggested fixes to reference data. Feeds the admin review queue; never applied automatically.';
