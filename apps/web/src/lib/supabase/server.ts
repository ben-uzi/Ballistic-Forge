import type { Database } from '@bf/db/types';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Client } from './client';
import { supabaseConfig } from '@/lib/env';

/**
 * The server client, bound to the request's cookies so row-level security sees
 * the signed-in user. Null in demo mode.
 */
export async function getServerClient(): Promise<Client | null> {
  if (supabaseConfig === null) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session instead, so this is safe to skip.
        }
      },
    },
  });
}

/**
 * A client that bypasses row-level security.
 *
 * Only for server-side work that genuinely has to see across users: the
 * aggregation job and the admin queue. Never import this into anything that
 * runs in the browser — the key it uses is a full-access credential.
 */
export function getServiceClient(): Client | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseConfig === null || serviceKey === undefined || serviceKey === '') return null;

  return createClient<Database>(supabaseConfig.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Admin emails come from the environment, never from a user-editable table. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
}
