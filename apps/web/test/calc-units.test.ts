import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, METRIC_UNITS, US_UNITS } from '@/lib/calc/defaults';
import { toSolveInput } from '@/lib/calc/map';
import type { CompareLoad } from '@/lib/calc/types';
import { compareLoadWithUnits, withUnits } from '@/lib/calc/units';

const relativeError = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('withUnits', () => {
  it('re-expresses the same physical quantity', () => {
    const metric = withUnits(DEFAULT_FORM, METRIC_UNITS);
    expect(metric.units.range).toBe('m');
    expect(metric.muzzleVelocity).toBeCloseTo(819.9, 1);
    expect(metric.weight).toBeCloseTo(9.072, 3);
    expect(metric.diameter).toBeCloseTo(6.71, 2);
    expect(metric.temperature).toBeCloseTo(15, 1);
    expect(metric.zeroRange).toBe(91);
  });

  it('leaves the solved trajectory essentially unchanged across a unit switch', () => {
    const us = toSolveInput(DEFAULT_FORM);
    const metric = toSolveInput(withUnits(DEFAULT_FORM, METRIC_UNITS));
    // Display rounding moves things a little; nothing should move much.
    expect(metric.muzzleVelocityMps).toBeCloseTo(us.muzzleVelocityMps, 1);
    expect(relativeError(metric.bullet.massKg, us.bullet.massKg)).toBeLessThan(1e-4);
    expect(metric.atmosphere.temperatureK).toBeCloseTo(us.atmosphere.temperatureK, 1);
  });

  it('only touches the fields belonging to a changed unit', () => {
    const switched = withUnits(DEFAULT_FORM, { range: 'm' });
    expect(switched.weight).toBe(DEFAULT_FORM.weight);
    expect(switched.diameter).toBe(DEFAULT_FORM.diameter);
    expect(switched.temperature).toBe(DEFAULT_FORM.temperature);
    expect(switched.zeroRange).not.toBe(DEFAULT_FORM.zeroRange);
  });

  it('round-trips back to the original values', () => {
    const there = withUnits(DEFAULT_FORM, METRIC_UNITS);
    const back = withUnits(there, US_UNITS);
    expect(back.weight).toBeCloseTo(DEFAULT_FORM.weight, 0);
    expect(back.muzzleVelocity).toBeCloseTo(DEFAULT_FORM.muzzleVelocity, 0);
    expect(back.temperature).toBeCloseTo(DEFAULT_FORM.temperature, 0);
    expect(back.sightHeight).toBeCloseTo(DEFAULT_FORM.sightHeight, 2);
  });

  it('keeps unknown values unknown', () => {
    const unknown = withUnits({ ...DEFAULT_FORM, bulletLength: null, twist: null }, METRIC_UNITS);
    expect(unknown.bulletLength).toBeNull();
    expect(unknown.twist).toBeNull();
  });

  it('never lets the range step round down to zero', () => {
    const tiny = withUnits({ ...DEFAULT_FORM, rangeStep: 1 }, { range: 'm' });
    expect(tiny.rangeStep).toBeGreaterThanOrEqual(1);
  });

  it('converts the wind hold speeds alongside the wind', () => {
    const metric = withUnits({ ...DEFAULT_FORM, windSpeed: 10 }, { windSpeed: 'mps' });
    expect(metric.windSpeed).toBeCloseTo(4.5, 1);
    expect(metric.windHoldSpeeds[0]).toBeCloseTo(2.2, 1);
  });
});

describe('compareLoadWithUnits', () => {
  const load: CompareLoad = {
    id: 'cmp',
    label: '.308 175 SMK',
    bcType: 'G1',
    bcValue: 0.505,
    weight: 175,
    diameter: 0.308,
    bulletLength: 1.24,
    muzzleVelocity: 2600,
  };

  it('converts a compared load with the form', () => {
    const metric = compareLoadWithUnits(load, US_UNITS, METRIC_UNITS);
    expect(metric.weight).toBeCloseTo(11.34, 3);
    expect(metric.diameter).toBeCloseTo(7.82, 2);
    expect(metric.muzzleVelocity).toBeCloseTo(792.5, 1);
    // The ballistic coefficient is already unitless-by-convention; it must not move.
    expect(metric.bcValue).toBe(0.505);
  });

  it('is a no-op when the units did not change', () => {
    expect(compareLoadWithUnits(load, US_UNITS, US_UNITS)).toEqual(load);
  });
});
