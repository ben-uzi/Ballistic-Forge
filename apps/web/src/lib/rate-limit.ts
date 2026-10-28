/**
 * A small fixed-window rate limiter.
 *
 * In-memory, so it is per-instance and resets on deploy. That is honest for the
 * pilot: it stops a single client hammering an endpoint, and it is not a
 * defence against a distributed attacker. When the backend exists this moves to
 * a shared store (Supabase or the platform's own limiter) so the window is
 * global rather than per-instance.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Seconds until the window resets. */
  readonly retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (existing === undefined || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

/** Test seam, and a way to keep the map from growing without bound. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * A caller key from the request.
 *
 * Proxy headers can be forged, so this is a courtesy limiter rather than a
 * security control, and it never logs or stores the address.
 */
export function callerKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  return `${scope}:${ip}`;
}
