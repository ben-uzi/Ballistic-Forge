import { LocalStore } from './local';
import type { ProfileStore } from './types';

export * from './types';
export { LocalStore } from './local';
export { SupabaseStore, SupabaseStoreNotReadyError } from './supabase';

let cached: ProfileStore | null = null;

/**
 * The store the app should use right now.
 *
 * Phase 2 always returns the local store: guest mode is the only mode until the
 * Supabase schema exists (Phase 3). The selection moves to
 * `hasSupabase && signedIn ? SupabaseStore : LocalStore` there, which is why
 * callers already treat the result as opaque.
 */
export function getStore(): ProfileStore {
  cached ??= new LocalStore();
  return cached;
}

/** Test seam. */
export function setStore(store: ProfileStore | null): void {
  cached = store;
}
