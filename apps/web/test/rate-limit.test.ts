import { beforeEach, describe, expect, it } from 'vitest';
import { callerKey, rateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows up to the limit', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit('k', 5, 1000, 0).allowed).toBe(true);
    }
  });

  it('blocks the one after', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('k', 5, 1000, 0);
    const result = rateLimit('k', 5, 1000, 0);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('counts down the remaining allowance', () => {
    expect(rateLimit('k', 3, 1000, 0).remaining).toBe(2);
    expect(rateLimit('k', 3, 1000, 0).remaining).toBe(1);
    expect(rateLimit('k', 3, 1000, 0).remaining).toBe(0);
  });

  it('opens a fresh window once the old one expires', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('k', 5, 1000, 0);
    expect(rateLimit('k', 5, 1000, 0).allowed).toBe(false);
    expect(rateLimit('k', 5, 1000, 1001).allowed).toBe(true);
  });

  it('tells a blocked caller when to come back', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('k', 5, 60_000, 0);
    expect(rateLimit('k', 5, 60_000, 0).retryAfter).toBe(60);
  });

  it('keeps separate callers apart', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('a', 5, 1000, 0);
    expect(rateLimit('a', 5, 1000, 0).allowed).toBe(false);
    expect(rateLimit('b', 5, 1000, 0).allowed).toBe(true);
  });
});

describe('callerKey', () => {
  it('uses the first address in a forwarded chain', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
    });
    expect(callerKey(request, 'waitlist')).toBe('waitlist:203.0.113.7');
  });

  it('falls back rather than throwing when there is no header', () => {
    expect(callerKey(new Request('https://example.com'), 'waitlist')).toBe('waitlist:unknown');
  });

  it('scopes the key, so limits do not leak between endpoints', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(callerKey(request, 'a')).not.toBe(callerKey(request, 'b'));
  });
});
