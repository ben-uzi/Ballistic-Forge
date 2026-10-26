/**
 * Entitlements. Payments are stubbed for the pilot (BUILD_BRIEF §2): every beta
 * user is a `founder`, which unlocks everything. The single config below is the
 * only place Free vs Pro is described, so Phase 7 can gate features by editing it.
 */

export type Tier = 'free' | 'pro' | 'founder';

export type Feature =
  | 'calculator'
  | 'profiles'
  | 'dope_pdf'
  | 'range_mode'
  | 'suppressor_module'
  | 'field_logging'
  | 'compare_loads'
  | 'truing'
  | 'data_export';

const FREE: readonly Feature[] = [
  'calculator',
  'profiles',
  'range_mode',
  'field_logging',
  'data_export',
];

const PRO: readonly Feature[] = [
  ...FREE,
  'dope_pdf',
  'suppressor_module',
  'compare_loads',
  'truing',
];

export const TIER_FEATURES: Readonly<Record<Tier, readonly Feature[]>> = {
  free: FREE,
  pro: PRO,
  // Beta testers keep everything, permanently.
  founder: PRO,
};

/** Tier used until Phase 7 reads `entitlements` from Supabase. */
export const PILOT_TIER: Tier = 'founder';

export function hasFeature(tier: Tier, feature: Feature): boolean {
  return TIER_FEATURES[tier].includes(feature);
}
