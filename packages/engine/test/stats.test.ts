import { describe, expect, it } from 'vitest';
import {
  extremeSpread,
  filterOutliersMad,
  lnGamma,
  mean,
  meanConfidenceInterval,
  median,
  medianAbsoluteDeviation,
  regularizedIncompleteBeta,
  standardDeviation,
  studentTCdf,
  studentTQuantile,
  summarize,
} from '../src/stats';

describe('descriptive statistics', () => {
  const v = [2700, 2710, 2695, 2705, 2690];

  it('mean, sample SD, ES', () => {
    expect(mean(v)).toBe(2700);
    expect(standardDeviation(v)).toBeCloseTo(Math.sqrt(250 / 4), 12);
    expect(extremeSpread(v)).toBe(20);
  });

  it('median for odd and even counts', () => {
    expect(median(v)).toBe(2700);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it('MAD', () => {
    expect(medianAbsoluteDeviation([1, 1, 2, 2, 4, 6, 9])).toBe(1);
  });

  it('summarize handles single shots', () => {
    expect(summarize([2700])).toEqual({ n: 1, mean: 2700, sd: null, es: 0, min: 2700, max: 2700 });
    expect(summarize(v).sd).toBeCloseTo(standardDeviation(v), 12);
  });

  it('rejects too few values', () => {
    expect(() => mean([])).toThrow(RangeError);
    expect(() => standardDeviation([1])).toThrow(/at least 2 values/);
    expect(() => median([])).toThrow(/at least 1 value$/);
  });
});

describe('special functions', () => {
  it('lnGamma matches factorials and Γ(1/2) = √π', () => {
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lnGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 12);
    expect(lnGamma(0.25)).toBeCloseTo(Math.log(3.625609908221908), 10);
  });

  it('incomplete beta: bounds and symmetry', () => {
    expect(regularizedIncompleteBeta(0, 2, 3)).toBe(0);
    expect(regularizedIncompleteBeta(1, 2, 3)).toBe(1);
    expect(regularizedIncompleteBeta(0.5, 4, 4)).toBeCloseTo(0.5, 12);
    expect(regularizedIncompleteBeta(0.3, 2, 5) + regularizedIncompleteBeta(0.7, 5, 2)).toBeCloseTo(
      1,
      12,
    );
    // I_x(1, 1) = x
    expect(regularizedIncompleteBeta(0.37, 1, 1)).toBeCloseTo(0.37, 12);
  });

  it('t CDF is symmetric', () => {
    expect(studentTCdf(0, 5)).toBeCloseTo(0.5, 12);
    expect(studentTCdf(-1.3, 7) + studentTCdf(1.3, 7)).toBeCloseTo(1, 12);
  });

  it('t quantile matches closed forms for df = 1 and df = 2', () => {
    // df = 1 is Cauchy: t = tan(π(p − ½)); df = 2: t = (2p − 1) / √(2p(1 − p)).
    expect(studentTQuantile(0.975, 1)).toBeCloseTo(Math.tan(Math.PI * 0.475), 8);
    expect(studentTQuantile(0.975, 2)).toBeCloseTo(0.95 / Math.sqrt(2 * 0.975 * 0.025), 8);
    expect(studentTQuantile(0.025, 2)).toBeCloseTo(-0.95 / Math.sqrt(2 * 0.975 * 0.025), 8);
  });

  it('t quantile approaches the normal 1.95996 for large df', () => {
    expect(studentTQuantile(0.975, 1e6)).toBeCloseTo(1.959964, 4);
  });

  it('t quantile rejects bad arguments', () => {
    expect(() => studentTQuantile(1, 3)).toThrow(RangeError);
    expect(() => studentTQuantile(0.9, 0)).toThrow(RangeError);
  });
});

describe('confidence interval', () => {
  it('is mean ± t·s/√n', () => {
    const v = [2700, 2710, 2695, 2705, 2690];
    const ci = meanConfidenceInterval(v);
    const t = studentTQuantile(0.975, 4);
    expect(ci.halfWidth).toBeCloseTo((t * standardDeviation(v)) / Math.sqrt(5), 12);
    expect(ci.low).toBeCloseTo(2700 - ci.halfWidth, 12);
    expect(ci.high).toBeCloseTo(2700 + ci.halfWidth, 12);
    expect(ci.level).toBe(0.95);
    expect(meanConfidenceInterval(v, 0.9).halfWidth).toBeLessThan(ci.halfWidth);
  });
});

describe('MAD outlier filter', () => {
  it('excludes a gross outlier and keeps the rest', () => {
    const r = filterOutliersMad([2700, 2705, 2698, 2702, 2710, 2950]);
    expect(r.kept).toEqual([2700, 2705, 2698, 2702, 2710]);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0]?.index).toBe(5);
    expect(r.excluded[0]?.score).toBeGreaterThan(3.5);
  });

  it('falls back to mean absolute deviation when MAD is zero', () => {
    const r = filterOutliersMad([2700, 2700, 2700, 2700, 2900]);
    expect(r.excluded.map((e) => e.value)).toEqual([2900]);
  });

  it('excludes nothing when all values are identical', () => {
    const r = filterOutliersMad([2700, 2700, 2700]);
    expect(r.kept).toHaveLength(3);
    expect(r.scale).toBe(0);
  });
});
