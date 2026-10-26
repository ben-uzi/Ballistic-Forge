import { describe, expect, it } from 'vitest';
import {
  CLICK_VALUES,
  buildDope,
  elevationCorrection,
  rangeSteps,
  toClicks,
  windageCorrection,
} from '../src/dope';
import { convertAngle } from '../src/units';
import { syntheticInput, yd } from './helpers';

const mil = (v: number) => convertAngle(v, 'mil', 'rad');
const moa = (v: number) => convertAngle(v, 'moa', 'rad');

describe('rangeSteps', () => {
  it('is inclusive of both ends', () => {
    expect(rangeSteps(0, 100, 25)).toEqual([0, 25, 50, 75, 100]);
    expect(rangeSteps(0, yd(1000), yd(100))).toHaveLength(11);
  });

  it('handles empty and invalid input', () => {
    expect(rangeSteps(100, 0, 10)).toEqual([]);
    expect(() => rangeSteps(0, 100, 0)).toThrow(RangeError);
  });
});

describe('clicks', () => {
  it('rounds to the nearest click', () => {
    expect(toClicks(mil(2.34), CLICK_VALUES.mil_0_1, 'nearest')).toBe(23);
    expect(toClicks(mil(2.36), CLICK_VALUES.mil_0_1, 'nearest')).toBe(24);
    expect(toClicks(moa(5.1), CLICK_VALUES.moa_0_25, 'nearest')).toBe(20);
    expect(toClicks(moa(5.1), CLICK_VALUES.moa_0_125, 'nearest')).toBe(41);
  });

  it('rounds down toward zero, symmetric for negative corrections', () => {
    expect(toClicks(mil(2.39), CLICK_VALUES.mil_0_1, 'down')).toBe(23);
    expect(toClicks(mil(-2.39), CLICK_VALUES.mil_0_1, 'down')).toBe(-23);
    expect(toClicks(mil(-2.36), CLICK_VALUES.mil_0_1, 'nearest')).toBe(-24);
    expect(toClicks(mil(2.3), CLICK_VALUES.mil_0_1, 'down')).toBe(23);
  });

  it('never returns negative zero', () => {
    expect(Object.is(toClicks(mil(-0.01), CLICK_VALUES.mil_0_1, 'nearest'), 0)).toBe(true);
  });

  it('supports custom click values in another unit than the display unit', () => {
    const c = elevationCorrection(mil(1), 'moa', { value: 0.5, unit: 'moa' }, 'nearest');
    expect(c.value).toBeCloseTo(3.4377, 4);
    expect(c.clicks).toBe(7);
    expect(c.dialed).toBeCloseTo(3.5, 12);
    expect(c.direction).toBe('U');
  });

  it('labels directions', () => {
    expect(elevationCorrection(mil(-0.5), 'mil', CLICK_VALUES.mil_0_1, 'nearest').direction).toBe(
      'D',
    );
    expect(windageCorrection(mil(0.5), 'mil', CLICK_VALUES.mil_0_1, 'nearest').direction).toBe('R');
    expect(windageCorrection(mil(-0.5), 'mil', CLICK_VALUES.mil_0_1, 'nearest').direction).toBe(
      'L',
    );
    expect(windageCorrection(0, 'mil', CLICK_VALUES.mil_0_1, 'nearest').direction).toBeNull();
  });
});

describe('buildDope', () => {
  const input = syntheticInput({
    ranges: rangeSteps(0, yd(1000), yd(100)),
    wind: { speedMps: 9, fromRad: 0.3 },
  });
  const table = buildDope(input, {
    unit: 'mil',
    elevationClick: CLICK_VALUES.mil_0_1,
    windageClick: CLICK_VALUES.mil_0_1,
    rounding: 'nearest',
    windSpeedsMps: [2.2352, 4.4704],
  });

  it('has one row per range with elevation from the still-air solution', () => {
    expect(table.rows).toHaveLength(11);
    const r1000 = table.rows[10];
    expect(r1000?.elevation.value).toBeCloseTo(
      (table.solution.rows[10]?.elevationRad ?? 0) * 1000,
      9,
    );
    expect(r1000?.elevation.direction).toBe('U');
  });

  it('ignores the input wind for elevation/drift (wind goes in the hold columns)', () => {
    expect(table.solution.rows[10]?.windageM).toBe(table.solution.rows[10]?.spinDriftM);
  });

  it('lists holds into a 3 o’clock wind that scale ~linearly with speed', () => {
    const holds = table.rows[10]?.windHolds ?? [];
    expect(holds.map((h) => h.speedMps)).toEqual([2.2352, 4.4704]);
    const [five, ten] = holds;
    expect(five?.correction.direction).toBe('R');
    expect((ten?.correction.value ?? 0) / (five?.correction.value ?? 1)).toBeCloseTo(2, 1);
  });

  it('reports spin drift as a left correction for right-hand twist', () => {
    expect(table.rows[10]?.drift.direction).toBe('L');
  });

  it('has zero holds at the muzzle', () => {
    expect(table.rows[0]?.windHolds[0]?.correction.value).toBe(0);
  });
});
