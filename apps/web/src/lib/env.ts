/**
 * Environment detection. The app must run with no environment variables at all —
 * in that case it is in "demo mode": guest profiles in localStorage, no sync,
 * no accounts (NEEDS_CHAD 1).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True once a Supabase project is wired up. */
export const hasSupabase = Boolean(url && anonKey);

export const supabaseConfig: { url: string; anonKey: string } | null =
  url && anonKey ? { url, anonKey } : null;

/** What the UI should call the current mode. */
export type AppMode = 'demo' | 'connected';

export const appMode: AppMode = hasSupabase ? 'connected' : 'demo';
