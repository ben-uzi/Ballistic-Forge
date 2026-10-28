/**
 * Database types.
 *
 * Hand-maintained to match `supabase/migrations`, because `supabase gen types`
 * needs a running project and the pilot has none yet (NEEDS_CHAD 1). Drift is
 * caught by `test/schema.test.ts`, which applies the real migrations to an
 * in-process Postgres and compares the table and column lists against `TABLES`
 * and the row types below — so this file cannot silently fall out of step.
 */

// ── Enums (mirrors of the Postgres enum types) ───────────────────────────────

export type ManufacturerType = 'bullet' | 'ammo' | 'suppressor' | 'rifle';

export type MountType =
  'direct_thread' | 'hub_1375x24' | 'asr' | 'keymo' | 'omega_qd' | 'proprietary_qd' | 'other';

export type TwistDirection = 'right' | 'left';
export type AngularUnit = 'mil' | 'moa' | 'iphy';
export type PressureType = 'station' | 'baro';
export type MvSource = 'advertised' | 'chronograph' | 'trued' | 'estimated';
export type ChronoType =
  'garmin_xero' | 'labradar' | 'magnetospeed' | 'optical' | 'other' | 'unknown';
export type SessionStatus = 'draft' | 'submitted' | 'flagged' | 'excluded';
export type UserRole = 'user' | 'admin';
export type EntitlementTier = 'free' | 'pro' | 'founder';
export type CorrectionStatus = 'open' | 'accepted' | 'rejected';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ── Shared column groups ─────────────────────────────────────────────────────

type Timestamps = {
  created_at: string;
  updated_at: string;
};

/** The audit trail every reference row carries (BUILD_BRIEF §7.1). */
type Sourced = {
  source_url: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
};

// ── Reference rows ───────────────────────────────────────────────────────────

export type ManufacturerRow = Timestamps & {
  id: string;
  name: string;
  type: ManufacturerType;
  website_url: string | null;
};

export type CartridgeRow = Timestamps &
  Sourced & {
    id: string;
    name: string;
    bullet_diameter_in: number;
    saami_max_pressure_psi: number | null;
  };

export type BulletRow = Timestamps &
  Sourced & {
    id: string;
    manufacturer_id: string;
    name: string;
    diameter_in: number;
    weight_gr: number;
    length_in: number | null;
    bc_g1: number | null;
    bc_g7: number | null;
    bc_bands: Json | null;
  };

export type FactoryLoadRow = Timestamps &
  Sourced & {
    id: string;
    manufacturer_id: string;
    cartridge_id: string;
    bullet_id: string | null;
    product_name: string;
    sku: string | null;
    advertised_mv_fps: number;
    test_barrel_in: number | null;
  };

export type SuppressorRow = Timestamps &
  Sourced & {
    id: string;
    manufacturer_id: string;
    model: string;
    mount_type: MountType;
    thread_pitch: string | null;
    bore_diameter_in: number;
    max_rated_cartridge: string | null;
    rated_cartridges: string[];
    length_in: number | null;
    diameter_in: number | null;
    weight_oz: number | null;
    min_barrel_length_note: string | null;
    full_auto_rated: boolean | null;
  };

// ── User-owned rows ──────────────────────────────────────────────────────────

export type ProfileRow = Timestamps & {
  user_id: string;
  display_name: string | null;
  units_pref: Json;
  role: UserRole;
  beta_cohort: string | null;
  contribution_opt_in: boolean;
  flagged: boolean;
};

/** Note the absence of any serial-number column. That is deliberate and permanent. */
export type RifleRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  cartridge_id: string | null;
  cartridge_name: string | null;
  barrel_length_in: number | null;
  twist_in: number | null;
  twist_dir: TwistDirection;
  thread_pitch: string | null;
  sight_height_in: number;
  zero_range_yd: number;
  zero_conditions: Json | null;
  click_elev: string;
  click_wind: string;
  angular_unit: AngularUnit;
  notes: string | null;
  archived_at: string | null;
};

export type LoadRow = Timestamps & {
  id: string;
  user_id: string;
  rifle_id: string;
  name: string;
  bullet_id: string | null;
  factory_load_id: string | null;
  custom_bullet: Json | null;
  mv_fps: number;
  mv_source: MvSource;
  mv_temp_f: number | null;
  temp_sensitivity_fps_per_f: number | null;
  trued_mv: Json | null;
  trued_bc: Json | null;
  notes: string | null;
  archived_at: string | null;
};

export type RifleSuppressorRow = Timestamps & {
  id: string;
  user_id: string;
  rifle_id: string;
  suppressor_id: string;
  measured_mv_delta_fps: number | null;
  measured_poi_shift: Json | null;
  measured_at: string | null;
  notes: string | null;
};

export type SessionRow = Timestamps & {
  id: string;
  user_id: string;
  rifle_id: string;
  load_id: string;
  suppressor_id: string | null;
  occurred_on: string;
  temp_f: number | null;
  pressure: number | null;
  pressure_type: PressureType | null;
  altitude_ft: number | null;
  rh_percent: number | null;
  region_coarse: string | null;
  chrono_type: ChronoType;
  status: SessionStatus;
  status_reason: string | null;
  notes: string | null;
};

export type ShotStringRow = Timestamps & {
  id: string;
  user_id: string;
  session_id: string;
  suppressed: boolean;
  velocities_fps: number[];
  first_round_cold: boolean;
  label: string | null;
  excluded: boolean;
  excluded_reason: string | null;
};

export type DropObservationRow = Timestamps & {
  id: string;
  user_id: string;
  session_id: string;
  range_yd: number;
  observed_elev_correction: number;
  unit: AngularUnit;
  observed_wind_correction: number | null;
  wind_estimate: Json | null;
  hit: boolean | null;
  notes: string | null;
};

export type PoiShiftObservationRow = Timestamps & {
  id: string;
  user_id: string;
  session_id: string;
  distance_yd: number;
  vertical_in: number;
  horizontal_in: number;
  group_size_in: number | null;
};

export type EntitlementRow = Timestamps & {
  id: string;
  user_id: string;
  tier: EntitlementTier;
  source: string;
  expires_at: string | null;
};

export type EventRow = {
  id: string;
  user_id: string | null;
  name: string;
  props: Json;
  created_at: string;
};

// ── Aggregates and app tables ────────────────────────────────────────────────

export type FieldAggregateRow = {
  id: string;
  group_key: string;
  bullet_id: string | null;
  factory_load_id: string | null;
  barrel_length_bucket_in: number | null;
  suppressor_id: string | null;
  n_shots: number;
  n_sessions: number;
  n_users: number;
  mv_mean: number | null;
  mv_sd_between_sessions: number | null;
  mv_ci95_low: number | null;
  mv_ci95_high: number | null;
  sd_mean_within_session: number | null;
  es_mean: number | null;
  normalized_temp_f: number | null;
  updated_at: string;
};

export type SuppressorDeltaRow = {
  id: string;
  suppressor_id: string;
  cartridge_id: string | null;
  barrel_length_bucket_in: number | null;
  n_sessions: number;
  n_users: number;
  mv_delta_mean: number | null;
  mv_delta_sd: number | null;
  mv_delta_ci95_low: number | null;
  mv_delta_ci95_high: number | null;
  poi_vertical_mean: number | null;
  poi_horizontal_mean: number | null;
  updated_at: string;
};

export type AppFlagRow = {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
};

export type WaitlistRow = {
  id: string;
  email: string;
  note: string | null;
  invited_at: string | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  user_id: string | null;
  message: string;
  url: string | null;
  screenshot_path: string | null;
  resolved: boolean;
  created_at: string;
};

export type CorrectionRow = {
  id: string;
  user_id: string | null;
  table_name: string;
  row_id: string;
  field_name: string;
  suggested_value: string;
  source_url: string | null;
  reason: string | null;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

// ── Insert / Update shapes ───────────────────────────────────────────────────

/**
 * Column names that carry a database default wherever they appear, and so are
 * optional on insert. `test/schema.test.ts` checks this list against
 * information_schema, so it cannot drift away from the migrations.
 */
export const DEFAULTED_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'verified',
  'role',
  'contribution_opt_in',
  'flagged',
  'units_pref',
  'twist_dir',
  'zero_range_yd',
  'click_elev',
  'click_wind',
  'angular_unit',
  'mv_source',
  'rated_cartridges',
  'occurred_on',
  'chrono_type',
  'status',
  'suppressed',
  'first_round_cold',
  'excluded',
  'unit',
  'tier',
  'source',
  'props',
  'n_shots',
  'n_sessions',
  'n_users',
  'resolved',
] as const;

type Defaulted = (typeof DEFAULTED_COLUMNS)[number];

/** Nullable columns are optional on insert too — omitting one means NULL. */
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];

type OptionalOnInsert<T> = (Defaulted & keyof T) | NullableKeys<T>;

type Insertable<T> = Omit<T, OptionalOnInsert<T>> & Partial<Pick<T, OptionalOnInsert<T>>>;

type Updatable<T> = Partial<Omit<T, 'id' | 'created_at'>>;

type Table<T> = {
  Row: T;
  Insert: Insertable<T>;
  Update: Updatable<T>;
  /** supabase-js requires this key; we do not model embedded-resource joins. */
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      manufacturers: Table<ManufacturerRow>;
      cartridges: Table<CartridgeRow>;
      bullets: Table<BulletRow>;
      factory_loads: Table<FactoryLoadRow>;
      suppressors: Table<SuppressorRow>;
      profiles: Table<ProfileRow>;
      rifles: Table<RifleRow>;
      loads: Table<LoadRow>;
      rifle_suppressors: Table<RifleSuppressorRow>;
      sessions: Table<SessionRow>;
      shot_strings: Table<ShotStringRow>;
      drop_observations: Table<DropObservationRow>;
      poi_shift_observations: Table<PoiShiftObservationRow>;
      entitlements: Table<EntitlementRow>;
      events: Table<EventRow>;
      field_aggregates: Table<FieldAggregateRow>;
      suppressor_deltas: Table<SuppressorDeltaRow>;
      app_flags: Table<AppFlagRow>;
      waitlist: Table<WaitlistRow>;
      feedback: Table<FeedbackRow>;
      corrections: Table<CorrectionRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      field_data_is_public: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      manufacturer_type: ManufacturerType;
      mount_type: MountType;
      twist_direction: TwistDirection;
      angular_unit: AngularUnit;
      pressure_type: PressureType;
      mv_source: MvSource;
      chrono_type: ChronoType;
      session_status: SessionStatus;
      user_role: UserRole;
      entitlement_tier: EntitlementTier;
      correction_status: CorrectionStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database['public']['Tables'];

/**
 * Every table the migrations create. `test/schema.test.ts` asserts this matches
 * the live schema exactly, in both directions.
 */
export const TABLES: readonly TableName[] = [
  'manufacturers',
  'cartridges',
  'bullets',
  'factory_loads',
  'suppressors',
  'profiles',
  'rifles',
  'loads',
  'rifle_suppressors',
  'sessions',
  'shot_strings',
  'drop_observations',
  'poi_shift_observations',
  'entitlements',
  'events',
  'field_aggregates',
  'suppressor_deltas',
  'app_flags',
  'waitlist',
  'feedback',
  'corrections',
];

/** Tables holding data owned by one user, all of them owner-only under RLS. */
export const OWNER_ONLY_TABLES: readonly TableName[] = [
  'rifles',
  'loads',
  'rifle_suppressors',
  'sessions',
  'shot_strings',
  'drop_observations',
  'poi_shift_observations',
];
