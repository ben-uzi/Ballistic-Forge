import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasSupabase } from '@/lib/env';

export const runtime = 'nodejs';

const WaitlistRequest = z.object({
  email: z.email().max(320),
  /** Free text: what they shoot. Optional and never required. */
  note: z.string().max(500).optional(),
});

export type WaitlistResponse =
  | { readonly ok: true; readonly stored: 'supabase' | 'local' }
  | { readonly ok: false; readonly error: string };

/**
 * Beta waitlist sign-up.
 *
 * With no Supabase project configured the app is in demo mode, so the address
 * is written to the server log and the caller is told plainly that it was
 * *not* persisted — better than a green tick over a dropped signup
 * (NEEDS_CHAD 1). The Supabase insert lands with the schema in Phase 3.
 */
export async function POST(request: Request): Promise<NextResponse<WaitlistResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = WaitlistRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'That does not look like an email address.' },
      { status: 400 },
    );
  }

  if (!hasSupabase) {
    // Demo mode has nowhere else to put it.
    console.info('[waitlist:demo] %s', parsed.data.email);
    return NextResponse.json({ ok: true, stored: 'local' });
  }

  return NextResponse.json(
    { ok: false, error: 'The waitlist table arrives with the database in Phase 3.' },
    { status: 503 },
  );
}
