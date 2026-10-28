import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasSupabase } from '@/lib/env';
import { callerKey, rateLimit } from '@/lib/rate-limit';
import { getServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const FeedbackInput = z.object({
  message: z.string().trim().min(1).max(4000),
  url: z.string().trim().max(500).optional(),
  /** Set when the user is suggesting a reference-data correction. */
  correction: z
    .object({
      table: z.enum(['bullets', 'factory_loads', 'suppressors', 'cartridges', 'manufacturers']),
      rowId: z.string().trim().max(120),
      field: z.string().trim().max(60),
      suggested: z.string().trim().max(300),
      sourceUrl: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export type FeedbackResponse =
  | { readonly ok: true; readonly stored: 'supabase' | 'local' }
  | { readonly ok: false; readonly error: string };

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Feedback and reference-data corrections.
 *
 * A correction is never applied automatically: it lands in a review queue for a
 * human, because the whole point of the library is that every figure traces to
 * a source somebody checked.
 */
export async function POST(request: Request): Promise<NextResponse<FeedbackResponse>> {
  const limit = rateLimit(callerKey(request, 'feedback'), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions. Try again later.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = FeedbackInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'That message could not be read.' },
      { status: 400 },
    );
  }

  if (!hasSupabase) {
    // Demo mode has nowhere to put it, and says so rather than pretending.
    console.info('[feedback:demo] %s', parsed.data.message.slice(0, 200));
    return NextResponse.json({ ok: true, stored: 'local' });
  }

  const supabase = await getServerClient();
  if (supabase === null) {
    return NextResponse.json(
      { ok: false, error: 'Feedback is not reachable right now.' },
      { status: 503 },
    );
  }

  const { correction, message, url } = parsed.data;

  if (correction !== undefined) {
    const { error } = await supabase.from('corrections').insert({
      table_name: correction.table,
      row_id: correction.rowId,
      field_name: correction.field,
      suggested_value: correction.suggested,
      source_url: correction.sourceUrl ?? null,
      reason: message,
      user_id: null,
    });
    if (error !== null) {
      return NextResponse.json({ ok: false, error: 'That did not go through.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, stored: 'supabase' });
  }

  const { error } = await supabase.from('feedback').insert({
    message,
    url: url ?? null,
    user_id: null,
    screenshot_path: null,
  });
  if (error !== null) {
    return NextResponse.json({ ok: false, error: 'That did not go through.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, stored: 'supabase' });
}
