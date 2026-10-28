import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { DOPE_FORMATS, buildDopeCard } from '@/lib/dope/build';
import { formFromProfile } from '@/lib/profiles/to-form';
import { newLoad, newRifle, type Clock } from '@/lib/store/factories';
import type { StoredLoad, StoredRifle } from '@/lib/store/types';

let counter = 0;
const fixedClock: Clock = {
  now: () => '2026-01-01T00:00:00.000Z',
  id: () => `id-${String((counter += 1))}`,
};

const rifle: StoredRifle = newRifle(
  { name: 'Tikka T3x', cartridge: '6.5 Creedmoor', twistIn: 8, zeroRangeYd: 100 },
  fixedClock,
);

const baseLoad: StoredLoad = newLoad('r1', { name: '140 ELD-M' }, fixedClock);

const cardFor = (load: StoredLoad = baseLoad, over: Partial<typeof DEFAULT_FORM> = {}) => {
  const form = formFromProfile(rifle, load, {
    ...DEFAULT_FORM,
    rangeStart: 100,
    rangeEnd: 500,
    rangeStep: 100,
    ...over,
  });
  return buildDopeCard(rifle, load, form, { now: new Date('2026-06-01T12:00:00Z') });
};

describe('buildDopeCard', () => {
  it('produces one row per requested range', () => {
    const card = cardFor();
    expect(card.rows.map((row) => row.range)).toEqual(['100', '200', '300', '400', '500']);
  });

  it('carries the rifle and load identity onto the card', () => {
    const card = cardFor();
    expect(card.rifleName).toBe('Tikka T3x');
    expect(card.loadName).toBe('140 ELD-M');
    expect(card.bullet).toContain('140 gr');
    expect(card.bc).toBe('G7 0.326');
    expect(card.zero).toBe('100 yd');
    expect(card.sightHeight).toBe('1.9 in');
    expect(card.clicks).toBe('0.1 mil');
  });

  it('states the conditions the numbers were computed at', () => {
    const card = cardFor();
    expect(card.atmosphere).toContain('59 °F');
    expect(card.atmosphere).toContain('inHg station');
    expect(card.atmosphere).toContain('50% RH');
  });

  it('gives a wind hold column per requested speed', () => {
    const card = cardFor();
    expect(card.windLabels).toEqual(['5 mph', '10 mph']);
    for (const row of card.rows) {
      expect(row.winds).toHaveLength(2);
      expect(row.winds[0]).not.toBe('—');
    }
  });

  it('holds more wind at 10 mph than at 5', () => {
    const card = cardFor();
    const last = card.rows.at(-1);
    const five = Number.parseFloat(last?.winds[0] ?? '0');
    const ten = Number.parseFloat(last?.winds[1] ?? '0');
    expect(ten).toBeGreaterThan(five);
  });

  it('dials up and increasingly so with distance', () => {
    const card = cardFor();
    const values = card.rows.map((row) => Number.parseFloat(row.elevation));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i] ?? 0).toBeGreaterThan(values[i - 1] ?? 0);
    }
    expect(card.rows.at(-1)?.elevation).toMatch(/U$/);
  });

  it('reports whole clicks alongside the angular value', () => {
    const card = cardFor();
    expect(card.rows.at(-1)?.clicks).toMatch(/^\d+ U$/);
  });

  it('flags transonic and subsonic rows for shading', () => {
    const card = cardFor(baseLoad, { rangeStart: 1000, rangeEnd: 1600, rangeStep: 200 });
    expect(card.rows.some((row) => row.transonic || row.subsonic)).toBe(true);
    // The near rows of the same card must not be flagged.
    expect(card.rows[0]?.subsonic).toBe(false);
  });

  it('notes a trued muzzle velocity rather than hiding it', () => {
    const card = cardFor({
      ...baseLoad,
      truedMuzzleVelocityFps: { value: 2663, at: '2026-05-01', atRangeYd: 800 },
    });
    expect(card.muzzleVelocity).toBe('2663 fps');
    expect(card.muzzleVelocityNote).toContain('trued');
  });

  it('notes a powder temperature correction', () => {
    const card = cardFor({
      ...baseLoad,
      muzzleVelocityAtTempF: 70,
      temperatureSensitivityFpsPerF: 1.2,
    });
    expect(card.muzzleVelocityNote).toContain('for temperature');
  });

  it('says nothing about velocity provenance when there is nothing to say', () => {
    expect(cardFor().muzzleVelocityNote).toBeNull();
  });

  it('is not labelled suppressed unless asked', () => {
    expect(cardFor().suppressed).toBe(false);
  });

  it('stamps when it was generated', () => {
    expect(cardFor().generatedAt).toBe('2026-06-01 12:00');
  });
});

describe('card formats', () => {
  it('offer letter, half page and a scope band', () => {
    expect(Object.keys(DOPE_FORMATS)).toEqual(['letter', 'half', 'band']);
  });

  it('shrink the column set as the paper gets narrower', () => {
    expect(DOPE_FORMATS.letter.columns.length).toBeGreaterThan(DOPE_FORMATS.half.columns.length);
    expect(DOPE_FORMATS.half.columns.length).toBeGreaterThan(DOPE_FORMATS.band.columns.length);
  });

  it('always keep range, elevation and wind', () => {
    for (const spec of Object.values(DOPE_FORMATS)) {
      expect(spec.columns).toContain('range');
      expect(spec.columns).toContain('elevation');
      expect(spec.columns).toContain('wind');
    }
  });

  it('get smaller type on smaller paper', () => {
    expect(DOPE_FORMATS.band.fontSize).toBeLessThan(DOPE_FORMATS.letter.fontSize);
  });
});
