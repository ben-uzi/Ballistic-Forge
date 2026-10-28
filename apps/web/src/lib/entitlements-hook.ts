'use client';

import { PILOT_TIER, hasFeature, type Feature, type Tier } from './entitlements';

/**
 * Whether the current user may use a feature.
 *
 * Every beta tester is a `founder`, so this returns true for everything today.
 * It exists now so Phase 7's gating is already threaded through the UI: when
 * entitlements come from the database, only this hook changes.
 */
export function useEntitlement(feature: Feature): boolean {
  return hasFeature(useTier(), feature);
}

export function useTier(): Tier {
  return PILOT_TIER;
}
