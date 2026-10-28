import { describe, expect, it } from 'vitest';
import {
  aggregateSessions,
  barrelBucket,
  effectiveSampleSize,
  groupKeyFor,
  normalizeToStandardTemp,
  stringLengthWeight,
  trustWeight,
  weightedMean,
  type SessionSample,
} from '../src/aggregate.ts';

let counter = 0;

/** A clean, contributing session. Tests take things away or change them. */
function session(over: Partial<SessionSample> = {}): SessionSample {
  counter += 1;
  return {
    sessionId: `s${String(counter)}`,
    userId: `u${String(counter)}`,
    userFlagged: false,
    contributionOptIn: true,
    occurredOn: '2026-05-01',
    bulletId: 'bullet-1',
    factoryLoadId: null,
    barrelLengthIn: 24,
    suppressorId: null,
    chronoType: 'garmin_xero',
    tempF: null,
    tempSensitivityFpsPerF: null,
    advertisedMvFps: null,
    strings: [{ suppressed: false, velocitiesFps: [2690, 2695, 2688, 2692, 2691] }],
    ...over,
  };
}

/** Six sessions from six shooters: enough to clear the disclosure thresholds. */
function sixShooters(over: Partial<SessionSample> = {}): SessionSample[] {
  return [2688, 2690, 2692, 2694, 2696, 2698].map((base, index) =>
    session({
      sessionId: `s-${String(index)}`,
      userId: `u-${String(index)}`,
      strings: [
        { suppressed: false, velocitiesFps: [base, base + 2, base - 2, base + 1, base - 1] },
      ],
      ...over,
    }),
  );
}

describe('grouping', () => {
  it('buckets barrel length to the nearest inch', () => {
    expect(barrelBucket(24.4)).toBe(24);
    expect(barrelBucket(23.6)).toBe(24);
    expect(barrelBucket(null)).toBeNull();
  });

  it('keys on load, barrel bucket and suppressor', () => {
    expect(
      groupKeyFor({
        bulletId: 'b1',
        factoryLoadId: null,
        barrelLengthIn: 24,
        suppressorId: null,
      }),
    ).toBe('b:b1|24|none');
  });

  it('prefers a factory load over a component bullet', () => {
    expect(
      groupKeyFor({
        bulletId: 'b1',
        factoryLoadId: 'fl1',
        barrelLengthIn: 20,
        suppressorId: 'can1',
      }),
    ).toBe('fl:fl1|20|can1');
  });

  it('has no group for a session that names neither', () => {
    expect(
      groupKeyFor({
        bulletId: null,
        factoryLoadId: null,
        barrelLengthIn: 24,
        suppressorId: null,
      }),
    ).toBeNull();
  });

  it('separates suppressed and unsuppressed into different groups', () => {
    const plain = groupKeyFor({
      bulletId: 'b1',
      factoryLoadId: null,
      barrelLengthIn: 24,
      suppressorId: null,
    });
    const canned = groupKeyFor({
      bulletId: 'b1',
      factoryLoadId: null,
      barrelLengthIn: 24,
      suppressorId: 'can1',
    });
    expect(plain).not.toBe(canned);
  });

  it('separates different barrel lengths', () => {
    const sessions = [
      ...sixShooters({ barrelLengthIn: 24 }),
      ...sixShooters({ barrelLengthIn: 20 }),
    ];
    expect(aggregateSessions(sessions).aggregates).toHaveLength(2);
  });
});

describe('consent and standing', () => {
  it('excludes a user who has opted out, with a readable reason', () => {
    const { aggregates, excluded } = aggregateSessions([session({ contributionOptIn: false })]);
    expect(aggregates).toHaveLength(0);
    expect(excluded[0]?.reason).toBe('opted-out');
    expect(excluded[0]?.message).toMatch(/yours alone/i);
  });

  it('excludes a flagged account', () => {
    const { aggregates, excluded } = aggregateSessions([session({ userFlagged: true })]);
    expect(aggregates).toHaveLength(0);
    expect(excluded[0]?.reason).toBe('account-flagged');
  });

  it('excludes a session with no load identity', () => {
    const { excluded } = aggregateSessions([session({ bulletId: null, factoryLoadId: null })]);
    expect(excluded[0]?.reason).toBe('no-load-identity');
  });
});

describe('plausibility gates', () => {
  it('rejects a chronograph misread', () => {
    const { excluded } = aggregateSessions([
      session({ strings: [{ suppressed: false, velocitiesFps: [2690, 2695, 12] }] }),
    ]);
    expect(excluded[0]?.reason).toBe('implausible-velocity');
  });

  it('rejects a string that is pure noise', () => {
    const { excluded } = aggregateSessions([
      session({ strings: [{ suppressed: false, velocitiesFps: [2400, 2600, 2900, 2500, 2800] }] }),
    ]);
    expect(excluded[0]?.reason).toBe('implausible-spread');
  });

  it('rejects a mean far from the advertised velocity', () => {
    const { excluded } = aggregateSessions([session({ advertisedMvFps: 2000 })]);
    expect(excluded[0]?.reason).toBe('far-from-advertised');
  });

  it('accepts a mean inside the advertised tolerance', () => {
    const { aggregates } = aggregateSessions(sixShooters({ advertisedMvFps: 2710 }));
    expect(aggregates).toHaveLength(1);
  });

  it('rejects a session with no string matching its suppressor state', () => {
    const { excluded } = aggregateSessions([
      session({
        suppressorId: 'can1',
        strings: [{ suppressed: false, velocitiesFps: [2690, 2695] }],
      }),
    ]);
    expect(excluded[0]?.reason).toBe('no-usable-string');
  });
});

describe('temperature normalisation', () => {
  it('corrects to 59 degrees when sensitivity is known', () => {
    const result = normalizeToStandardTemp(2690, 90, 1.2);
    expect(result.normalized).toBe(true);
    // 31 degrees cooler at 1.2 fps per degree.
    expect(result.fps).toBeCloseTo(2690 - 37.2, 1);
  });

  it('leaves the mean alone when the temperature is unknown', () => {
    const result = normalizeToStandardTemp(2690, null, 1.2);
    expect(result).toEqual({ fps: 2690, normalized: false });
  });

  it('leaves the mean alone when the sensitivity is unknown', () => {
    const result = normalizeToStandardTemp(2690, 90, null);
    expect(result).toEqual({ fps: 2690, normalized: false });
  });

  it('marks the aggregate un-normalised unless every session could be corrected', () => {
    const sessions = sixShooters({ tempF: 70, tempSensitivityFpsPerF: 1 });
    const mixed = [...sessions];
    mixed[0] = { ...session(), sessionId: 'mixed', userId: 'u-mixed' };
    const { aggregates } = aggregateSessions(mixed);
    expect(aggregates[0]?.normalized).toBe(false);
    expect(aggregates[0]?.normalizedTempF).toBeNull();
  });

  it('reports the normalisation temperature when every session qualifies', () => {
    const { aggregates } = aggregateSessions(sixShooters({ tempF: 70, tempSensitivityFpsPerF: 1 }));
    expect(aggregates[0]?.normalized).toBe(true);
    expect(aggregates[0]?.normalizedTempF).toBe(59);
  });
});

describe('per-user cap', () => {
  it('counts only the first three sessions from one shooter', () => {
    const sessions = [2690, 2691, 2692, 2693, 2694].map((base, index) =>
      session({
        sessionId: `cap-${String(index)}`,
        userId: 'same-user',
        occurredOn: `2026-05-0${String(index + 1)}`,
        strings: [{ suppressed: false, velocitiesFps: [base, base + 1, base - 1] }],
      }),
    );
    const { aggregates, excluded } = aggregateSessions(sessions);
    expect(aggregates[0]?.nSessions).toBe(3);
    expect(aggregates[0]?.nUsers).toBe(1);
    expect(excluded.filter((e) => e.reason === 'per-user-cap')).toHaveLength(2);
  });

  it('keeps the earliest sessions, not the most agreeable ones', () => {
    const sessions = [2600, 2700, 2800, 2900].map((base, index) =>
      session({
        sessionId: `order-${String(index)}`,
        userId: 'same-user',
        occurredOn: `2026-05-0${String(index + 1)}`,
        strings: [{ suppressed: false, velocitiesFps: [base, base + 1, base - 1] }],
      }),
    );
    const { excluded } = aggregateSessions(sessions);
    expect(excluded.find((e) => e.reason === 'per-user-cap')?.sessionId).toBe('order-3');
  });

  it('explains the cap in terms the contributor can act on', () => {
    const sessions = Array.from({ length: 4 }, (_, index) =>
      session({
        sessionId: `m${String(index)}`,
        userId: 'same',
        occurredOn: `2026-05-0${String(index + 1)}`,
      }),
    );
    const { excluded } = aggregateSessions(sessions);
    expect(excluded[0]?.message).toMatch(/no single shooter dominates/i);
    expect(excluded[0]?.message).toMatch(/your own history/i);
  });

  it('respects a configured cap', () => {
    const sessions = Array.from({ length: 4 }, (_, index) =>
      session({
        sessionId: `c${String(index)}`,
        userId: 'same',
        occurredOn: `2026-05-0${String(index + 1)}`,
      }),
    );
    expect(aggregateSessions(sessions, { sessionsPerUser: 1 }).aggregates[0]?.nSessions).toBe(1);
  });
});

describe('trust weighting', () => {
  it('rates a long string above a short one', () => {
    expect(stringLengthWeight(20)).toBeGreaterThan(stringLengthWeight(6));
    expect(stringLengthWeight(6)).toBeGreaterThan(stringLengthWeight(3));
    expect(stringLengthWeight(3)).toBeGreaterThan(stringLengthWeight(1));
  });

  it('rates a doppler chronograph above an unknown one', () => {
    expect(trustWeight('garmin_xero', 10)).toBeGreaterThan(trustWeight('unknown', 10));
    expect(trustWeight('labradar', 10)).toBeGreaterThan(trustWeight('optical', 10));
  });

  it('pulls the mean towards the better-evidenced session', () => {
    const trusted = weightedMean([2600, 2700], [1, 0.25]);
    expect(trusted).toBeLessThan(2650);
  });

  it('falls back to a plain mean when every weight is zero', () => {
    expect(weightedMean([10, 20], [0, 0])).toBe(15);
  });

  it('computes an effective sample size that punishes lopsided weights', () => {
    expect(effectiveSampleSize([1, 1, 1, 1])).toBeCloseTo(4, 6);
    expect(effectiveSampleSize([1, 0.1, 0.1, 0.1])).toBeLessThan(2);
    expect(effectiveSampleSize([])).toBe(0);
  });
});

describe('outlier handling', () => {
  it('drops a session that disagrees with the group', () => {
    const sessions = [...sixShooters(), session({ sessionId: 'wild', userId: 'u-wild' })];
    sessions[6] = session({
      sessionId: 'wild',
      userId: 'u-wild',
      strings: [{ suppressed: false, velocitiesFps: [3100, 3102, 3098, 3101, 3099] }],
    });
    const { aggregates, excluded } = aggregateSessions(sessions);
    expect(excluded.some((e) => e.reason === 'statistical-outlier' && e.sessionId === 'wild')).toBe(
      true,
    );
    expect(aggregates[0]?.nSessions).toBe(6);
  });

  it('tells the owner their session still appears in their own history', () => {
    const sessions = [...sixShooters()];
    sessions.push(
      session({
        sessionId: 'wild',
        userId: 'u-wild',
        strings: [{ suppressed: false, velocitiesFps: [3100, 3102, 3098, 3101, 3099] }],
      }),
    );
    const { excluded } = aggregateSessions(sessions);
    const outlier = excluded.find((e) => e.reason === 'statistical-outlier');
    expect(outlier?.message).toMatch(/your own history still shows it/i);
  });
});

describe('the aggregate itself', () => {
  const { aggregates } = aggregateSessions(sixShooters());
  const group = aggregates[0];

  it('counts sessions, shooters and shots', () => {
    expect(group?.nSessions).toBe(6);
    expect(group?.nUsers).toBe(6);
    expect(group?.nShots).toBe(30);
  });

  it('lands the mean where the data is', () => {
    expect(group?.mvMean).toBeGreaterThan(2688);
    expect(group?.mvMean).toBeLessThan(2698);
  });

  it('reports spread between sessions and within them', () => {
    expect(group?.mvSdBetweenSessions).toBeGreaterThan(0);
    expect(group?.sdMeanWithinSession).toBeGreaterThan(0);
    expect(group?.esMean).toBeGreaterThan(0);
  });

  it('brackets the mean with a 95% interval', () => {
    expect(group?.mvCi95Low).toBeLessThan(group?.mvMean ?? 0);
    expect(group?.mvCi95High).toBeGreaterThan(group?.mvMean ?? 0);
  });

  it('has no interval from a single session', () => {
    const { aggregates: one } = aggregateSessions([session()]);
    expect(one[0]?.mvCi95Low).toBeNull();
    expect(one[0]?.mvSdBetweenSessions).toBeNull();
  });
});

describe('disclosure thresholds', () => {
  it('is not displayable below the session threshold', () => {
    const { aggregates } = aggregateSessions(sixShooters().slice(0, 4));
    expect(aggregates[0]?.nSessions).toBe(4);
    expect(aggregates[0]?.displayable).toBe(false);
  });

  it('is not displayable when too few shooters are behind it', () => {
    const sessions = Array.from({ length: 6 }, (_, index) =>
      session({
        sessionId: `few-${String(index)}`,
        userId: index < 3 ? 'a' : 'b',
        occurredOn: `2026-05-0${String((index % 3) + 1)}`,
      }),
    );
    const { aggregates } = aggregateSessions(sessions);
    expect(aggregates[0]?.nUsers).toBeLessThan(3);
    expect(aggregates[0]?.displayable).toBe(false);
  });

  it('becomes displayable once both thresholds are met', () => {
    const { aggregates } = aggregateSessions(sixShooters());
    expect(aggregates[0]?.displayable).toBe(true);
  });

  it('still computes a hidden aggregate, so the admin view has something to show', () => {
    const { aggregates } = aggregateSessions(sixShooters().slice(0, 2));
    expect(aggregates[0]?.mvMean).toBeGreaterThan(0);
    expect(aggregates[0]?.displayable).toBe(false);
  });
});

describe('suppressor deltas', () => {
  const paired = (index: number, delta: number): SessionSample =>
    session({
      sessionId: `p${String(index)}`,
      userId: `pu${String(index)}`,
      suppressorId: 'can-1',
      strings: [
        { suppressed: false, velocitiesFps: [2690, 2692, 2688] },
        { suppressed: true, velocitiesFps: [2690 + delta, 2692 + delta, 2688 + delta] },
      ],
    });

  it('measures the delta from paired strings in one session', () => {
    const { suppressorDeltas } = aggregateSessions([paired(1, 25)]);
    expect(suppressorDeltas[0]?.mvDeltaMean).toBeCloseTo(25, 1);
    expect(suppressorDeltas[0]?.nSessions).toBe(1);
  });

  it('ignores a session that only has one of the two strings', () => {
    const { suppressorDeltas } = aggregateSessions([
      session({ suppressorId: 'can-1', strings: [{ suppressed: true, velocitiesFps: [2715] }] }),
    ]);
    expect(suppressorDeltas).toHaveLength(0);
  });

  it('accumulates across shooters and reports an interval', () => {
    const sessions = [20, 22, 24, 26, 28, 30].map((delta, index) => paired(index, delta));
    const { suppressorDeltas } = aggregateSessions(sessions);
    expect(suppressorDeltas[0]?.nSessions).toBe(6);
    expect(suppressorDeltas[0]?.nUsers).toBe(6);
    expect(suppressorDeltas[0]?.mvDeltaMean).toBeCloseTo(25, 0);
    expect(suppressorDeltas[0]?.mvDeltaCi95Low).toBeLessThan(25);
    expect(suppressorDeltas[0]?.displayable).toBe(true);
  });

  it('stays hidden until enough shooters agree', () => {
    const { suppressorDeltas } = aggregateSessions([paired(1, 25), paired(2, 27)]);
    expect(suppressorDeltas[0]?.displayable).toBe(false);
  });

  it('excludes opted-out contributors from deltas too', () => {
    const optedOut = { ...paired(1, 25), contributionOptIn: false };
    expect(aggregateSessions([optedOut]).suppressorDeltas).toHaveLength(0);
  });
});
