'use client';

import type { Database } from '@bf/db/types';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/env';

export type Client = SupabaseClient<Database>;

let cached: Client | null = null;

/**
 * The browser client, or null in demo mode.
 *
 * Returning null rather than throwing is deliberate: every caller already has
 * to handle "no backend configured" because that is the pilot's default state
 * (NEEDS_CHAD 1), and a thrown error at module scope would take the calculator
 * down with it.
 */
export function getBrowserClient(): Client | null {
  if (supabaseConfig === null) return null;
  cached ??= createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.anonKey);
  return cached;
}
