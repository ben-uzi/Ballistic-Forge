import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, METRIC_UNITS } from '@/lib/calc/defaults';
import { runCalc } from '@/lib/calc/solve';
import {
  describeLoad,
  describeRifle,
  effectiveMuzzleVelocity,
  formFromProfile,
} from '@/lib/profiles/to-form';
import {
  duplicateLoad,
  duplicateRifle,
  newLoad,
  newRifle,
  type Clock,
} from '@/lib/store/factories';
import type { StoredLoad, StoredRifle } from '@/lib/store/types';

let counter = 0;
const fixedClock: Clock = {
  now: () => '2026-01-01T00:00:00.000Z',
  id: () => `id-${String((counter += 1))}`,
};

/*
 * `exactOptionalPropertyTypes` makes Partial<T> reject an explicit `undefined`,
 * which is exactly what these tests pass to mean "unknown". The cast is confined
 * to these two helpers; the spread always supplies every required field.
 */
type Overrides<T> = { -readonly [K in keyof T]?: T[K] | undefined };

const rifle = (over: Overrides<StoredRifle> = {}): StoredRifle =>
  ({
    ...newRifle({ name: 'Tikka T3x', cartridge: '6.5 Creedmoor', twistIn: 8 }, fixedClock),
    ...over,
  }) as StoredRifle;

const load = (over: Overrides<StoredLoad> = {}): StoredLoad =>
  ({
    ...newLoad('r1', { name: '140 ELD-M' }, fixedClock),
    ...over,
  }) as StoredLoad;

describe('factories', () => {
  it('build a solvable rifle and load out of the box', () => {
    expect(runCalc(formFromProfile(rifle(), load())).ok).toBe(true);
  });

  it('stamp ids and timestamps', () => {
    const made = newRifle({}, fixedClock);
    expect(made.id).toMatch(/^id-/);
    expect(made.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(made.updatedAt).toBe(made.createdAt);
  });

  it('duplicate under a new id with a distinguishable name', () => {
    const original = rifle();
    const copy = duplicateRifle(original, fixedClock);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('Tikka T3x (copy)');
    expect(copy.sightHeightIn).toBe(original.sightHeightIn);
  });

  it('duplicate a load and keep it on the same rifle', () => {
    const original = load();
    const copy = duplicateLoad(original, fixedClock);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('140 ELD-M (copy)');
    expect(copy.rifleId).toBe(original.rifleId);
  });
});

describe('effectiveMuzzleVelocity', () => {
  it('uses the entered velocity when nothing else is known', () => {
    const mv = effectiveMuzzleVelocity(load({ muzzleVelocityFps: 2690 }), 59);
    expect(mv.fps).toBe(2690);
    expect(mv.temperatureAdjustmentFps).toBe(0);
    expect(mv.trued).toBe(false);
  });

  it('prefers a trued velocity over the entered one', () => {
    const mv = effectiveMuzzleVelocity(
      load({
        muzzleVelocityFps: 2690,
        truedMuzzleVelocityFps: { value: 2663, at: '2026-05-01', atRangeYd: 800 },
      }),
      59,
    );
    expect(mv.fps).toBe(2663);
    expect(mv.source).toBe('trued');
    expect(mv.trued).toBe(true);
  });

  it('applies powder temperature sensitivity and reports the adjustment', () => {
    const mv = effectiveMuzzleVelocity(
      load({
        muzzleVelocityFps: 2690,
        muzzleVelocityAtTempF: 70,
        temperatureSensitivityFpsPerF: 1.2,
      }),
      30,
    );
    // 40 °F colder at 1.2 fps per °F.
    expect(mv.temperatureAdjustmentFps).toBeCloseTo(-48, 0);
    expect(mv.fps).toBeCloseTo(2642, 0);
  });

  it('warms a load up as readily as it cools one down', () => {
    const mv = effectiveMuzzleVelocity(
      load({
        muzzleVelocityFps: 2690,
        muzzleVelocityAtTempF: 70,
        temperatureSensitivityFpsPerF: 1.2,
      }),
      100,
    );
    expect(mv.temperatureAdjustmentFps).toBeCloseTo(36, 0);
  });

  it('leaves the velocity alone when the measurement temperature is unknown', () => {
    const mv = effectiveMuzzleVelocity(
      load({ muzzleVelocityFps: 2690, temperatureSensitivityFpsPerF: 1.2 }),
      0,
    );
    expect(mv.fps).toBe(2690);
    expect(mv.temperatureAdjustmentFps).toBe(0);
  });

  it('combines truing with the temperature correction', () => {
    const mv = effectiveMuzzleVelocity(
      load({
        muzzleVelocityFps: 2690,
        truedMuzzleVelocityFps: { value: 2663, at: '2026-05-01', atRangeYd: 800 },
        muzzleVelocityAtTempF: 70,
        temperatureSensitivityFpsPerF: 1.0,
      }),
      50,
    );
    expect(mv.fps).toBeCloseTo(2643, 0);
    expect(mv.source).toBe('trued');
  });
});

describe('formFromProfile', () => {
  it('carries the rifle and load across', () => {
    const form = formFromProfile(
      rifle({ sightHeightIn: 2.2, zeroRangeYd: 200, twistIn: 7.5, angularUnit: 'moa' }),
      load({ muzzleVelocityFps: 2750 }),
    );
    expect(form.sightHeight).toBe(2.2);
    expect(form.zeroRange).toBe(200);
    expect(form.twist).toBe(7.5);
    expect(form.muzzleVelocity).toBe(2750);
    expect(form.units.angular).toBe('moa');
  });

  it('leaves the conditions and output range the user already set', () => {
    const base = { ...DEFAULT_FORM, temperature: 95, windSpeed: 12, rangeEnd: 1500 };
    const form = formFromProfile(rifle(), load(), base);
    expect(form.temperature).toBe(95);
    expect(form.windSpeed).toBe(12);
    expect(form.rangeEnd).toBe(1500);
  });

  it('converts stored US values into the metric units on screen', () => {
    const base = { ...DEFAULT_FORM, units: METRIC_UNITS };
    const form = formFromProfile(rifle({ sightHeightIn: 2, zeroRangeYd: 100 }), load(), base);
    expect(form.sightHeight).toBeCloseTo(50.8, 1);
    expect(form.zeroRange).toBe(91);
    expect(form.muzzleVelocity).toBeCloseTo(819.9, 1);
  });

  it('marks a bullet nobody has verified', () => {
    expect(formFromProfile(rifle(), load()).dataUnverified).toBe(true);
  });

  it('keeps an unknown twist unknown', () => {
    expect(formFromProfile(rifle({ twistIn: undefined }), load()).twist).toBeNull();
  });

  it('applies the temperature correction at the conditions on screen', () => {
    const form = formFromProfile(
      rifle(),
      load({
        muzzleVelocityFps: 2690,
        muzzleVelocityAtTempF: 70,
        temperatureSensitivityFpsPerF: 1.2,
      }),
      { ...DEFAULT_FORM, temperature: 20 },
    );
    expect(form.muzzleVelocity).toBeCloseTo(2630, 0);
  });

  it('produces a form the solver accepts', () => {
    const outcome = runCalc(formFromProfile(rifle(), load()));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.rows.length).toBeGreaterThan(0);
  });
});

describe('descriptions', () => {
  it('summarise a load in one line', () => {
    expect(describeLoad(load({ muzzleVelocityFps: 2690 }))).toContain('140 gr');
    expect(describeLoad(load())).toContain('G7');
  });

  it('summarise a rifle without inventing missing details', () => {
    expect(describeRifle(rifle({ barrelLengthIn: 24 }))).toBe(
      '6.5 Creedmoor · 24 in · 1:8 · 100 yd zero',
    );
    expect(describeRifle(rifle({ twistIn: undefined, cartridge: '' }))).toBe('100 yd zero');
  });
});
