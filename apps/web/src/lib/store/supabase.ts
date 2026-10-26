import type { ProfileStore, StoreSnapshot, StoredLoad, StoredRifle, UnitPrefs } from './types';

/**
 * Placeholder for the signed-in store. The schema, typed client and RLS land in
 * Phase 3; this exists now so `getStore()` has a real branch to select and so
 * nothing in the UI has to know which store it is talking to.
 *
 * Every method throws rather than silently returning empty data — a half-wired
 * Supabase project must fail loudly in development, not look like an empty account.
 */
export class SupabaseStoreNotReadyError extends Error {
  constructor() {
    super('The Supabase store arrives in Phase 3. The app is running in guest mode until then.');
    this.name = 'SupabaseStoreNotReadyError';
  }
}

export class SupabaseStore implements ProfileStore {
  readonly kind = 'supabase' as const;

  private unavailable(): never {
    throw new SupabaseStoreNotReadyError();
  }

  listRifles(): Promise<StoredRifle[]> {
    return this.unavailable();
  }
  getRifle(): Promise<StoredRifle | null> {
    return this.unavailable();
  }
  saveRifle(): Promise<StoredRifle> {
    return this.unavailable();
  }
  deleteRifle(): Promise<void> {
    return this.unavailable();
  }
  listLoads(): Promise<StoredLoad[]> {
    return this.unavailable();
  }
  getLoad(): Promise<StoredLoad | null> {
    return this.unavailable();
  }
  saveLoad(): Promise<StoredLoad> {
    return this.unavailable();
  }
  deleteLoad(): Promise<void> {
    return this.unavailable();
  }
  getPrefs(): Promise<UnitPrefs> {
    return this.unavailable();
  }
  savePrefs(): Promise<UnitPrefs> {
    return this.unavailable();
  }
  exportAll(): Promise<StoreSnapshot> {
    return this.unavailable();
  }
  importAll(): Promise<void> {
    return this.unavailable();
  }
  clearAll(): Promise<void> {
    return this.unavailable();
  }
}
