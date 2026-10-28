import { convertVelocity } from '@bf/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { toSolveInput } from '@/lib/calc/map';
import { runCalc } from '@/lib/calc/solve';
import { DEFAULT_FLAGS } from '@/lib/flags';
import { newSuppressorSetup, type Clock } from '@/lib/store/factories';
import type { StoredSuppressorSetup } from '@/lib/store/types';
import {
  resolveSuppressorDelta,
  toAdjustment,
  withSuppressor,
  type FieldDelta,
} from '@/lib/suppressors/resolve';

const clock: Clock = { now: () => '2026-01-01T00:00:00.000Z', id: () => 'setup-1' };

const setup = (over: Partial<StoredSuppressorSetup> = {}): StoredSuppressorSetup => ({
  ...newSuppressorSetup('rifle-1', 'can-1', {}, clock),
  ...over,
});

const field: FieldDelta = {
  mvDeltaFps: 24,
  poiVerticalIn: 0.8,
  poiHorizontalIn: -0.3,
  sessions: 12,
  users: 7,
};

const REVEALED = { ...DEFAULT_FLAGS, fieldDataPublic: true };

describe('resolution order', () => {
  it('prefers your own measurement above everything', () => {
    const resolved = resolveSuppressorDelta(setup({ mvDeltaFps: 31 }), field, REVEALED);
    expect(resolved.source).toBe('user');
    expect(resolved.mvDeltaFps).toBe(31);
  });

  it('falls back to field data when you have measured nothing', () => {
    const resolved = resolveSuppressorDelta(null, field, REVEALED);
    expect(resolved.source).toBe('field');
    expect(resolved.mvDeltaFps).toBe(24);
    expect(resolved.sampleSize).toBe(12);
  });

  it('ignores field data while the reveal flag is off', () => {
    const resolved = resolveSuppressorDelta(null, field, DEFAULT_FLAGS);
    expect(resolved.source).toBe('none');
    expect(resolved.mvDeltaFps).toBeNull();
  });

  it('ignores field data from too few sessions', () => {
    const thin: FieldDelta = { ...field, sessions: 2 };
    expect(resolveSuppressorDelta(null, thin, REVEALED).source).toBe('none');
  });

  it('ignores field data from too few shooters', () => {
    const narrow: FieldDelta = { ...field, users: 2 };
    expect(resolveSuppressorDelta(null, narrow, REVEALED).source).toBe('none');
  });

  it('never invents a delta when there is nothing to use', () => {
    const resolved = resolveSuppressorDelta(null, null, REVEALED);
    expect(resolved.source).toBe('none');
    expect(resolved.mvDeltaFps).toBeNull();
    expect(resolved.poiVerticalIn).toBeNull();
    expect(resolved.poiHorizontalIn).toBeNull();
  });

  it('tells the user how to get a number when there is none', () => {
    const resolved = resolveSuppressorDelta(null, null, REVEALED);
    expect(resolved.explanation).toMatch(/chronograph it suppressed and unsuppressed/i);
  });

  it('says where a field figure came from, and that it is not theirs', () => {
    const resolved = resolveSuppressorDelta(null, field, REVEALED);
    expect(resolved.explanation).toMatch(/12 sessions/);
    expect(resolved.explanation).toMatch(/7 shooters/);
    expect(resolved.explanation).toMatch(/your rifle will differ/i);
  });

  it('dates your own measurement when you recorded one', () => {
    const resolved = resolveSuppressorDelta(
      setup({ mvDeltaFps: 31, measuredAt: '2026-04-02' }),
      null,
      REVEALED,
    );
    expect(resolved.explanation).toContain('2026-04-02');
  });

  it('treats a setup with no velocity delta as no data', () => {
    // A setup row can exist just to record a POI shift.
    expect(resolveSuppressorDelta(setup({ poiVerticalIn: 1 }), null, REVEALED).source).toBe('none');
  });
});

describe('toAdjustment', () => {
  it('produces nothing when there is no delta', () => {
    expect(toAdjustment(resolveSuppressorDelta(null, null, REVEALED))).toBeNull();
  });

  it('converts the velocity delta into SI', () => {
    const adjustment = toAdjustment(
      resolveSuppressorDelta(setup({ mvDeltaFps: 30 }), null, REVEALED),
    );
    expect(adjustment?.mvDeltaMps).toBeCloseTo(convertVelocity(30, 'fps', 'mps'), 9);
    expect(adjustment?.source).toBe('user');
  });

  it('omits a POI shift when the measurement distance is unknown', () => {
    const adjustment = toAdjustment(
      resolveSuppressorDelta(setup({ mvDeltaFps: 30, poiVerticalIn: 1.5 }), null, REVEALED),
    );
    // An inches-at-unknown-distance figure cannot be turned into an angle.
    expect(adjustment?.poiShift).toBeUndefined();
  });

  it('turns a POI shift at a known distance into an angle', () => {
    const adjustment = toAdjustment(
      resolveSuppressorDelta(
        setup({ mvDeltaFps: 30, poiVerticalIn: 1.8, poiHorizontalIn: -0.9, measuredAtYd: 100 }),
        null,
        REVEALED,
      ),
    );
    // 1.8 in at 100 yd is 1.8 / 3600 radians, near enough.
    expect(adjustment?.poiShift?.verticalRad).toBeCloseTo(1.8 / 3600, 5);
    expect(adjustment?.poiShift?.horizontalRad).toBeCloseTo(-0.9 / 3600, 5);
  });

  it('carries the sample size through for field data', () => {
    const adjustment = toAdjustment(resolveSuppressorDelta(null, field, REVEALED));
    expect(adjustment?.source).toBe('field');
    expect(adjustment?.sampleSize).toBe(12);
  });
});

describe('withSuppressor', () => {
  const base = toSolveInput(DEFAULT_FORM);

  it('leaves the input untouched when nothing is measured', () => {
    const applied = withSuppressor(base, resolveSuppressorDelta(null, null, REVEALED));
    expect(applied.muzzleVelocityMps).toBe(base.muzzleVelocityMps);
  });

  it('raises the muzzle velocity by the measured delta', () => {
    const applied = withSuppressor(
      base,
      resolveSuppressorDelta(setup({ mvDeltaFps: 30 }), null, REVEALED),
    );
    expect(applied.muzzleVelocityMps - base.muzzleVelocityMps).toBeCloseTo(
      convertVelocity(30, 'fps', 'mps'),
      9,
    );
  });

  it('keeps the zero velocity from the unsuppressed configuration', () => {
    const applied = withSuppressor(
      base,
      resolveSuppressorDelta(setup({ mvDeltaFps: 30 }), null, REVEALED),
    );
    // The rifle was zeroed without the can, so the zero angle must not move.
    expect(applied.zero.muzzleVelocityMps).toBeCloseTo(base.muzzleVelocityMps, 9);
  });

  it('reverses the delta when detaching a can the rifle was zeroed with', () => {
    const resolved = resolveSuppressorDelta(setup({ mvDeltaFps: 30 }), null, REVEALED);
    const applied = withSuppressor(base, resolved, 'detach');
    expect(applied.muzzleVelocityMps).toBeLessThan(base.muzzleVelocityMps);
  });

  it('shifts the solution by a believable amount', () => {
    const suppressed = runCalc({
      ...DEFAULT_FORM,
      muzzleVelocity: DEFAULT_FORM.muzzleVelocity + 30,
    });
    const plain = runCalc(DEFAULT_FORM);
    expect(suppressed.ok && plain.ok).toBe(true);
    if (!suppressed.ok || !plain.ok) return;

    const suppressedDrop = suppressed.result.rows.at(-1)?.pathM ?? 0;
    const plainDrop = plain.result.rows.at(-1)?.pathM ?? 0;
    // 30 fps more velocity means measurably less drop at 1,000 yd.
    expect(suppressedDrop).toBeGreaterThan(plainDrop);
  });
});
