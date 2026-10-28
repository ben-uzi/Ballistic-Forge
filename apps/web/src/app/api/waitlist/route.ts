import { WaitlistInput } from '@bf/db/schemas';
import { NextResponse } from 'next/server';
import { hasSupabase } from '@/lib/env';
import { callerKey, rateLimit } from '@/lib/rate-limit';
import { getServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export type WaitlistResponse =
  | { readonly ok: true; readonly stored: 'supabase' | 'local' }
  | { readonly ok: false; readonly error: string };

/** Five sign-ups per address per hour is generous for a human and tedious for a script. */
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Beta waitlist sign-up.
 *
 * With no Supabase project configured the app is in demo mode, so the address
 * is written to the server log and the caller is told plainly that it was
 * *not* persisted — better than a green tick over a dropped signup
 * (NEEDS_CHAD 1).
 */
export async function POST(request: Request): Promise<NextResponse<WaitlistResponse>> {
  const limit = rateLimit(callerKey(request, 'waitlist'), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'That is a lot of sign-ups. Try again later.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = WaitlistInput.safeParse(body);
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

  const supabase = await getServerClient();
  if (supabase === null) {
    return NextResponse.json(
      { ok: false, error: 'The waitlist is not reachable right now.' },
      { status: 503 },
    );
  }

  const { error } = await supabase.from('waitlist').insert({
    email: parsed.data.email.toLowerCase(),
    note: parsed.data.note ?? null,
  });

  // 23505 is unique_violation: already signed up, which is a success from the
  // caller's point of view and must not leak who is on the list.
  if (error !== null && error.code !== '23505') {
    return NextResponse.json(
      { ok: false, error: 'That did not go through. Try again in a moment.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, stored: 'supabase' });
}
