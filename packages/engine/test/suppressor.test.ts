import { describe, expect, it } from 'vitest';
import { solve } from '../src/solver';
import { applySuppressor, poiShiftToAngular, type SuppressorAdjustment } from '../src/suppressor';
import { fps, inch, syntheticInput, yd } from './helpers';

const adjustment: SuppressorAdjustment = {
  source: 'user',
  mvDeltaMps: fps(25),
  poiShift: poiShiftToAngular(inch(0.5), inch(-0.25), yd(100)),
};

describe('suppressor adjustment', () => {
  it('converts a measured POI shift to an angle', () => {
    const a = poiShiftToAngular(inch(1), 0, yd(100));
    expect(Math.tan(a.verticalRad) * 3600).toBeCloseTo(1, 9);
    expect(a.horizontalRad).toBe(0);
  });

  it('attach: adds the MV delta and POI shift but keeps the unsuppressed zero', () => {
    const base = syntheticInput({ ranges: [yd(100), yd(800)] });
    const suppressed = applySuppressor(base, adjustment, 'attach');
    expect(suppressed.muzzleVelocityMps).toBeCloseTo(base.muzzleVelocityMps + fps(25), 12);
    expect(suppressed.zero.muzzleVelocityMps).toBe(base.muzzleVelocityMps);

    const plain = solve(base);
    const can = solve(suppressed);
    expect(can.zeroAngleRad).toBeCloseTo(plain.zeroAngleRad, 12);
    // At the zero range the impact moves by the measured POI shift (plus a hair for the extra MV).
    const shift = (can.rows[0]?.pathM ?? 0) - (plain.rows[0]?.pathM ?? 0);
    expect(shift).toBeGreaterThan(inch(0.5));
    expect(shift).toBeLessThan(inch(0.6));
    expect((can.rows[0]?.windageM ?? 0) - (plain.rows[0]?.windageM ?? 0)).toBeCloseTo(
      inch(-0.25),
      4,
    );
  });

  it('detach is the inverse direction and stacks with existing offsets', () => {
    const base = syntheticInput({
      options: { poiOffset: { verticalRad: 1e-4, horizontalRad: 0 } },
    });
    const off = applySuppressor(base, adjustment, 'detach');
    expect(off.muzzleVelocityMps).toBeCloseTo(base.muzzleVelocityMps - fps(25), 12);
    expect(off.options?.poiOffset?.verticalRad).toBeCloseTo(
      1e-4 - (adjustment.poiShift?.verticalRad ?? 0),
      15,
    );
  });

  it('keeps an explicit zero MV and tolerates a delta without POI data', () => {
    const base = syntheticInput({ zero: { rangeM: yd(100), muzzleVelocityMps: fps(2650) } });
    const out = applySuppressor(
      base,
      { source: 'field', mvDeltaMps: fps(10), sampleSize: 12 },
      'attach',
    );
    expect(out.zero.muzzleVelocityMps).toBe(fps(2650));
    expect(out.options?.poiOffset).toEqual({ verticalRad: 0, horizontalRad: 0 });
  });

  it('returns the input unchanged when there is no adjustment', () => {
    const base = syntheticInput();
    expect(applySuppressor(base, null, 'attach')).toBe(base);
  });
});
