import { z } from 'zod';

/**
 * Shared Zod schemas: seed-file validation and the app's form contracts.
 *
 * The numeric bounds here deliberately mirror the CHECK constraints in
 * `supabase/migrations`. The database is the real guard; these exist so a bad
 * seed row is rejected with a readable message before it ever reaches SQL, and
 * so forms reject the same values the database would.
 */

// ── Cell coercion helpers ────────────────────────────────────────────────────

/** A CSV cell that must be present and non-empty. */
const required = (label: string) => z.string().trim().min(1, `${label} is required`);

/** A CSV cell holding a number. Empty is an error; use `optionalNumber` instead. */
const numberCell = (label: string, min: number, max: number) =>
  required(label)
    .transform((value, ctx) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: 'custom', message: `${label} is not a number: "${value}"` });
        return z.NEVER;
      }
      return parsed;
    })
    .refine((value) => value >= min && value <= max, {
      message: `${label} must be between ${String(min)} and ${String(max)}`,
    });

/** A CSV cell holding an optional number. Empty becomes null. */
const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: 'custom', message: `${label} is not a number: "${value}"` });
        return z.NEVER;
      }
      if (parsed < min || parsed > max) {
        ctx.addIssue({
          code: 'custom',
          message: `${label} must be between ${String(min)} and ${String(max)}`,
        });
        return z.NEVER;
      }
      return parsed;
    });

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

const optionalBoolean = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value, ctx) => {
    if (value === '') return null;
    if (['true', 'yes', 'y', '1'].includes(value)) return true;
    if (['false', 'no', 'n', '0'].includes(value)) return false;
    ctx.addIssue({ code: 'custom', message: `Expected yes/no, got "${value}"` });
    return z.NEVER;
  });

/**
 * The hard line from the brief: no reference row exists without a citation, and
 * the citation has to be a real URL rather than "manufacturer website".
 */
const sourceUrl = required('source_url').refine((value) => /^https?:\/\/\S+\.\S+/.test(value), {
  message: 'source_url must be a full http(s) URL to the page the values came from',
});

// ── Shared physical bounds (mirrors of the SQL CHECK constraints) ────────────

export const BOUNDS = {
  diameterIn: [0.1, 1.0],
  weightGr: [10, 1000],
  lengthIn: [0.2, 3.0],
  bcG1: [0.05, 1.2],
  bcG7: [0.05, 0.7],
  mvFps: [300, 5000],
  barrelIn: [4, 40],
  suppressorLengthIn: [2, 20],
  suppressorWeightOz: [2, 60],
} as const satisfies Record<string, readonly [number, number]>;

export const MOUNT_TYPES = [
  'direct_thread',
  'hub_1375x24',
  'asr',
  'keymo',
  'omega_qd',
  'proprietary_qd',
  'other',
] as const;

export const MANUFACTURER_TYPES = ['bullet', 'ammo', 'suppressor', 'rifle'] as const;

// ── Seed-file schemas ────────────────────────────────────────────────────────

export const ManufacturerSeed = z.object({
  name: required('name'),
  type: z.enum(MANUFACTURER_TYPES),
  website_url: optionalText,
});
export type ManufacturerSeed = z.output<typeof ManufacturerSeed>;

export const CartridgeSeed = z.object({
  name: required('name'),
  bullet_diameter_in: numberCell('bullet_diameter_in', ...BOUNDS.diameterIn),
  saami_max_pressure_psi: optionalNumber('saami_max_pressure_psi', 10_000, 80_000),
  source_url: sourceUrl,
  notes: optionalText,
});
export type CartridgeSeed = z.output<typeof CartridgeSeed>;

export const BulletSeed = z
  .object({
    manufacturer: required('manufacturer'),
    name: required('name'),
    diameter_in: numberCell('diameter_in', ...BOUNDS.diameterIn),
    weight_gr: numberCell('weight_gr', ...BOUNDS.weightGr),
    length_in: optionalNumber('length_in', ...BOUNDS.lengthIn),
    bc_g1: optionalNumber('bc_g1', ...BOUNDS.bcG1),
    bc_g7: optionalNumber('bc_g7', ...BOUNDS.bcG7),
    source_url: sourceUrl,
    notes: optionalText,
  })
  .refine((row) => row.bc_g1 !== null || row.bc_g7 !== null, {
    message: 'A bullet needs at least one ballistic coefficient to be usable',
    path: ['bc_g1'],
  })
  .refine(
    // A G7 BC is roughly half the G1 for the same bullet. Catching a value
    // entered in the wrong column is worth one cheap sanity check.
    (row) => row.bc_g1 === null || row.bc_g7 === null || row.bc_g7 < row.bc_g1,
    {
      message: 'bc_g7 is not lower than bc_g1 — the two columns look swapped',
      path: ['bc_g7'],
    },
  );
export type BulletSeed = z.output<typeof BulletSeed>;

export const FactoryLoadSeed = z.object({
  manufacturer: required('manufacturer'),
  cartridge: required('cartridge'),
  /** Blank is allowed: some loads do not name a component bullet in the library. */
  bullet: optionalText,
  product_name: required('product_name'),
  sku: optionalText,
  advertised_mv_fps: numberCell('advertised_mv_fps', ...BOUNDS.mvFps),
  test_barrel_in: optionalNumber('test_barrel_in', ...BOUNDS.barrelIn),
  source_url: sourceUrl,
  notes: optionalText,
});
export type FactoryLoadSeed = z.output<typeof FactoryLoadSeed>;

export const SuppressorSeed = z.object({
  manufacturer: required('manufacturer'),
  model: required('model'),
  mount_type: z.enum(MOUNT_TYPES),
  thread_pitch: optionalText,
  bore_diameter_in: numberCell('bore_diameter_in', ...BOUNDS.diameterIn),
  max_rated_cartridge: optionalText,
  /** Semicolon-separated in the CSV, because cartridge names contain commas. */
  rated_cartridges: z
    .string()
    .trim()
    .transform((value) =>
      value === ''
        ? []
        : value
            .split(';')
            .map((entry) => entry.trim())
            .filter((entry) => entry !== ''),
    ),
  length_in: optionalNumber('length_in', ...BOUNDS.suppressorLengthIn),
  diameter_in: optionalNumber('diameter_in', 0.5, 3),
  weight_oz: optionalNumber('weight_oz', ...BOUNDS.suppressorWeightOz),
  min_barrel_length_note: optionalText,
  full_auto_rated: optionalBoolean,
  source_url: sourceUrl,
  notes: optionalText,
});
export type SuppressorSeed = z.output<typeof SuppressorSeed>;

export const SEED_SCHEMAS = {
  manufacturers: ManufacturerSeed,
  cartridges: CartridgeSeed,
  bullets: BulletSeed,
  factory_loads: FactoryLoadSeed,
  suppressors: SuppressorSeed,
} as const;

export type SeedFile = keyof typeof SEED_SCHEMAS;

/** The order rows must be inserted in to satisfy foreign keys. */
export const SEED_ORDER: readonly SeedFile[] = [
  'manufacturers',
  'cartridges',
  'bullets',
  'factory_loads',
  'suppressors',
];

// ── App-facing schemas ───────────────────────────────────────────────────────

export const UnitPrefsSchema = z.object({
  range: z.enum(['yd', 'm']),
  velocity: z.enum(['fps', 'mps']),
  energy: z.enum(['ftlbf', 'J']),
  temperature: z.enum(['F', 'C']),
  pressure: z.enum(['inHg', 'hPa']),
  angular: z.enum(['mil', 'moa', 'iphy']),
});

export const RifleInput = z.object({
  name: z.string().trim().min(1, 'Give the rifle a name').max(80),
  cartridge_id: z.uuid().nullable().optional(),
  cartridge_name: z.string().trim().max(80).nullable().optional(),
  barrel_length_in: z.number().min(4).max(40).nullable().optional(),
  twist_in: z.number().min(4).max(40).nullable().optional(),
  twist_dir: z.enum(['right', 'left']).default('right'),
  thread_pitch: z.string().trim().max(40).nullable().optional(),
  sight_height_in: z.number().min(0.1).max(10),
  zero_range_yd: z.number().min(10).max(1000),
  angular_unit: z.enum(['mil', 'moa', 'iphy']).default('mil'),
  click_elev: z.string().default('mil_0_1'),
  click_wind: z.string().default('mil_0_1'),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type RifleInput = z.input<typeof RifleInput>;

export const LoadInput = z.object({
  rifle_id: z.uuid(),
  name: z.string().trim().min(1, 'Give the load a name').max(80),
  bullet_id: z.uuid().nullable().optional(),
  factory_load_id: z.uuid().nullable().optional(),
  mv_fps: z.number().min(300).max(5000),
  mv_source: z.enum(['advertised', 'chronograph', 'trued', 'estimated']).default('advertised'),
  mv_temp_f: z.number().min(-60).max(140).nullable().optional(),
  temp_sensitivity_fps_per_f: z.number().min(-5).max(5).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type LoadInput = z.input<typeof LoadInput>;

export const ShotStringInput = z.object({
  suppressed: z.boolean().default(false),
  first_round_cold: z.boolean().default(false),
  label: z.string().trim().max(80).nullable().optional(),
  velocities_fps: z
    .array(z.number().min(300).max(5000))
    .min(1, 'A string needs at least one shot')
    .max(200, 'That is more shots than a single string holds'),
});
export type ShotStringInput = z.input<typeof ShotStringInput>;

export const SessionInput = z.object({
  rifle_id: z.uuid(),
  load_id: z.uuid(),
  suppressor_id: z.uuid().nullable().optional(),
  occurred_on: z.iso.date(),
  temp_f: z.number().min(-60).max(140).nullable().optional(),
  pressure: z.number().positive().nullable().optional(),
  pressure_type: z.enum(['station', 'baro']).nullable().optional(),
  altitude_ft: z.number().min(-1500).max(30_000).nullable().optional(),
  rh_percent: z.number().min(0).max(100).nullable().optional(),
  // Coarse only — a region name, never coordinates.
  region_coarse: z.string().trim().max(80).nullable().optional(),
  chrono_type: z
    .enum(['garmin_xero', 'labradar', 'magnetospeed', 'optical', 'other', 'unknown'])
    .default('unknown'),
  notes: z.string().trim().max(2000).nullable().optional(),
  strings: z.array(ShotStringInput).max(20),
});
export type SessionInput = z.input<typeof SessionInput>;

export const WaitlistInput = z.object({
  email: z.email().max(320),
  note: z.string().trim().max(500).optional(),
});
export type WaitlistInput = z.input<typeof WaitlistInput>;
