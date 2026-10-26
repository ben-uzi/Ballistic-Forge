import { describe, expect, it } from 'vitest';
import { scaledDragModel } from '../src/dragTables';
import { solve, type SolveInput } from '../src/solver';
import { trueBallisticCoefficient, trueMuzzleVelocity } from '../src/truing';
import { fps, syntheticInput, toFps, yd } from './helpers';

const elevationAt = (input: SolveInput, rangeM: number): number => {
  const [row] = solve({ ...input, ranges: [rangeM] }).rows;
  if (!row) throw new Error('unreachable');
  return row.elevationRad;
};

describe('muzzle velocity truing', () => {
  it('round-trips: recovers the true MV within 1 fps', () => {
    const truth = syntheticInput({ muzzleVelocityMps: fps(2700) });
    const observed = elevationAt(truth, yd(800));
    const result = trueMuzzleVelocity({
      base: { ...truth, muzzleVelocityMps: fps(2745) },
      distanceM: yd(800),
      observedElevationRad: observed,
    });
    expect(result.converged).toBe(true);
    expect(result.kind).toBe('muzzle-velocity');
    expect(Math.abs(toFps(result.value) - 2700)).toBeLessThan(1);
    expect(toFps(result.originalValue)).toBeCloseTo(2745, 6);
    expect(result.predictedElevationRad).toBeLessThan(observed);
    expect(result.warnings).toEqual([]);
    expect(result.atmosphere).toBe(truth.atmosphere);
  });

  it('shifts a separately specified zero MV by the same delta', () => {
    const truth = syntheticInput({
      muzzleVelocityMps: fps(2700),
      zero: { rangeM: yd(100), muzzleVelocityMps: fps(2680) },
    });
    const observed = elevationAt(truth, yd(800));
    const result = trueMuzzleVelocity({
      base: {
        ...truth,
        muzzleVelocityMps: fps(2730),
        zero: { rangeM: yd(100), muzzleVelocityMps: fps(2710) },
      },
      distanceM: yd(800),
      observedElevationRad: observed,
    });
    expect(Math.abs(toFps(result.value) - 2700)).toBeLessThan(1);
  });

  it('warns that a short truing distance is not meaningful', () => {
    const base = syntheticInput();
    const result = trueMuzzleVelocity({
      base,
      distanceM: yd(200),
      observedElevationRad: elevationAt(base, yd(200)),
    });
    expect(result.warnings.map((w) => w.code)).toContain('distance-too-short');
  });

  it('refuses inconsistent observations instead of returning nonsense', () => {
    const result = trueMuzzleVelocity({
      base: syntheticInput(),
      distanceM: yd(800),
      observedElevationRad: 0.05,
    });
    expect(result.converged).toBe(false);
    expect(result.value).toBe(result.originalValue);
    expect(result.warnings.map((w) => w.code)).toContain('out-of-bounds');
  });
});

describe('BC truing', () => {
  it('round-trips a BC scale factor at long range', () => {
    const base = syntheticInput();
    const truth = {
      ...base,
      bullet: { ...base.bullet, drag: scaledDragModel(base.bullet.drag, 0.95) },
    };
    const result = trueBallisticCoefficient({
      base,
      distanceM: yd(1100),
      observedElevationRad: elevationAt(truth, yd(1100)),
    });
    expect(result.converged).toBe(true);
    expect(result.kind).toBe('bc-scale');
    expect(result.originalValue).toBe(1);
    expect(result.value).toBeCloseTo(0.95, 3);
    expect(result.warnings).toEqual([]);
  });

  it('warns when the bullet is still well supersonic', () => {
    const base = syntheticInput();
    const result = trueBallisticCoefficient({
      base,
      distanceM: yd(400),
      observedElevationRad: elevationAt(base, yd(400)),
    });
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('still-supersonic');
    expect(codes).toContain('distance-too-short');
  });

  it('reports out-of-bounds when no BC scale fits', () => {
    const result = trueBallisticCoefficient({
      base: syntheticInput(),
      distanceM: yd(1000),
      observedElevationRad: 0.001,
    });
    expect(result.converged).toBe(false);
    expect(result.value).toBe(1);
    expect(result.warnings.find((w) => w.code === 'out-of-bounds')?.message).toContain('BC');
  });
});
