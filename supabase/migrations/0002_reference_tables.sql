-- 0002 — Reference data: manufacturers, cartridges, bullets, factory loads, suppressors.
--
-- Public read, admin write (policies in 0005). Every row that states a physical
-- fact carries `source_url` and `verified`, and `source_url` is NOT NULL — the
-- brief's hard line is that no reference row exists without a citation.

-- ── Manufacturers ────────────────────────────────────────────────────────────

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.manufacturer_type not null,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manufacturers_name_type_unique unique (name, type)
);

create trigger manufacturers_set_updated_at
  before update on public.manufacturers
  for each row execute function public.set_updated_at();

-- ── Cartridges ───────────────────────────────────────────────────────────────

create table public.cartridges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bullet_diameter_in numeric(6, 4) not null,
  saami_max_pressure_psi integer,
  source_url text not null,
  verified boolean not null default false,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cartridges_diameter_sane check (bullet_diameter_in between 0.1 and 1.0),
  constraint cartridges_pressure_sane check (
    saami_max_pressure_psi is null or saami_max_pressure_psi between 10000 and 80000
  )
);

create trigger cartridges_set_updated_at
  before update on public.cartridges
  for each row execute function public.set_updated_at();

-- ── Bullets ──────────────────────────────────────────────────────────────────

create table public.bullets (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete restrict,
  name text not null,
  diameter_in numeric(6, 4) not null,
  weight_gr numeric(7, 2) not null,
  length_in numeric(6, 4),
  bc_g1 numeric(6, 4),
  bc_g7 numeric(6, 4),
  -- Velocity-banded BCs (Sierra style): [{ "bc": 0.52, "min_velocity_fps": 2600 }, ...]
  bc_bands jsonb,
  source_url text not null,
  verified boolean not null default false,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bullets_name_unique unique (manufacturer_id, name, weight_gr),
  constraint bullets_diameter_sane check (diameter_in between 0.1 and 1.0),
  constraint bullets_weight_sane check (weight_gr between 10 and 1000),
  constraint bullets_length_sane check (length_in is null or length_in between 0.2 and 3.0),
  -- Plausibility bounds shared with the engine's validateStandardBc.
  constraint bullets_bc_g1_sane check (bc_g1 is null or bc_g1 between 0.05 and 1.2),
  constraint bullets_bc_g7_sane check (bc_g7 is null or bc_g7 between 0.05 and 0.7),
  -- A bullet with no BC at all cannot be solved with; it belongs in to_verify.csv.
  constraint bullets_has_a_bc check (bc_g1 is not null or bc_g7 is not null or bc_bands is not null)
);

create index bullets_diameter_idx on public.bullets (diameter_in);
create index bullets_manufacturer_idx on public.bullets (manufacturer_id);

create trigger bullets_set_updated_at
  before update on public.bullets
  for each row execute function public.set_updated_at();

-- ── Factory loads ────────────────────────────────────────────────────────────

create table public.factory_loads (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete restrict,
  cartridge_id uuid not null references public.cartridges (id) on delete restrict,
  bullet_id uuid references public.bullets (id) on delete set null,
  product_name text not null,
  sku text,
  advertised_mv_fps integer not null,
  -- The number that makes the factory-vs-field comparison honest.
  test_barrel_in numeric(5, 2),
  source_url text not null,
  verified boolean not null default false,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint factory_loads_unique unique (manufacturer_id, product_name, cartridge_id),
  constraint factory_loads_mv_sane check (advertised_mv_fps between 300 and 5000),
  constraint factory_loads_barrel_sane check (test_barrel_in is null or test_barrel_in between 4 and 40)
);

create index factory_loads_cartridge_idx on public.factory_loads (cartridge_id);

create trigger factory_loads_set_updated_at
  before update on public.factory_loads
  for each row execute function public.set_updated_at();

-- ── Suppressors ──────────────────────────────────────────────────────────────

create table public.suppressors (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete restrict,
  model text not null,
  mount_type public.mount_type not null,
  thread_pitch text,
  bore_diameter_in numeric(6, 4) not null,
  -- Free text exactly as the manufacturer writes it, e.g. '.300 Win Mag'.
  max_rated_cartridge text,
  rated_cartridges text[] not null default '{}',
  length_in numeric(5, 2),
  diameter_in numeric(5, 3),
  weight_oz numeric(6, 2),
  -- Verbatim from the manufacturer, or null. Never summarised, never inferred.
  min_barrel_length_note text,
  full_auto_rated boolean,
  source_url text not null,
  verified boolean not null default false,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppressors_unique unique (manufacturer_id, model),
  constraint suppressors_bore_sane check (bore_diameter_in between 0.1 and 1.0),
  constraint suppressors_length_sane check (length_in is null or length_in between 2 and 20),
  constraint suppressors_weight_sane check (weight_oz is null or weight_oz between 2 and 60)
);

create trigger suppressors_set_updated_at
  before update on public.suppressors
  for each row execute function public.set_updated_at();

comment on table public.suppressors is
  'Suppressor specifications from manufacturer pages only. Missing data stays NULL so the compatibility checker can answer "unknown" rather than pass.';
