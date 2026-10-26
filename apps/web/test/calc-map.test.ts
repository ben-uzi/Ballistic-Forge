import {
  KG_PER_GRAIN,
  METERS_PER_INCH,
  METERS_PER_YARD,
  MPS_PER_MPH,
  PA_PER_INHG,
  convertTemperature,
} from '@bf/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, METRIC_UNITS } from '@/lib/calc/defaults';
import {
  currentAtmosphere,
  rangeListM,
  toDopeOptions,
  toSolveInput,
  windFrom,
  zeroAtmosphere,
} from '@/lib/calc/map';
import type { CalcForm, CompareLoad } from '@/lib/calc/types';

const form = DEFAULT_FORM;

describe('toSolveInput', () => {
  it('converts the bullet to SI', () => {
    const input = toSolveInput(form);
    expect(input.bullet.massKg).toBeCloseTo(140 * KG_PER_GRAIN, 12);
    expect(input.bullet.diameterM).toBeCloseTo(0.264 * METERS_PER_INCH, 12);
    expect(input.bullet.lengthM).toBeCloseTo(1.345 * METERS_PER_INCH, 12);
    expect(input.bullet.drag.id).toBe('G7:0.326');
  });

  it('converts the rifle and zero to SI', () => {
    const input = toSolveInput(form);
    expect(input.rifle.sightHeightM).toBeCloseTo(1.9 * METERS_PER_INCH, 12);
    expect(input.rifle.twistM).toBeCloseTo(8 * METERS_PER_INCH, 12);
    expect(input.rifle.twistDirection).toBe('right');
    expect(input.zero.rangeM).toBeCloseTo(100 * METERS_PER_YARD, 12);
  });

  it('converts the muzzle velocity', () => {
    expect(toSolveInput(form).muzzleVelocityMps).toBeCloseTo(2690 * 0.3048, 9);
  });

  it('omits optional inputs rather than passing undefined', () => {
    const input = toSolveInput(form);
    // exactOptionalPropertyTypes means a missing key and an undefined value differ.
    expect('offsetM' in input.zero).toBe(false);
    expect('atmosphere' in input.zero).toBe(false);
    expect('wind' in input).toBe(false);
    expect('inclineRad' in input).toBe(false);
    expect('coriolis' in input).toBe(false);
  });

  it('includes wind, incline and Coriolis once they are non-trivial', () => {
    const windy: CalcForm = {
      ...form,
      windSpeed: 10,
      inclineDeg: 30,
      coriolisEnabled: true,
      latitudeDeg: 45,
      azimuthDeg: 90,
    };
    const input = toSolveInput(windy);
    expect(input.wind?.speedMps).toBeCloseTo(10 * MPS_PER_MPH, 12);
    expect(input.inclineRad).toBeCloseTo(Math.PI / 6, 12);
    expect(input.coriolis?.latitudeRad).toBeCloseTo(Math.PI / 4, 12);
    expect(input.coriolis?.azimuthRad).toBeCloseTo(Math.PI / 2, 12);
  });

  it('drops the bullet length and twist when they are unknown', () => {
    const unknown: CalcForm = { ...form, bulletLength: null, twist: null };
    const input = toSolveInput(unknown);
    expect('lengthM' in input.bullet).toBe(false);
    expect('twistM' in input.rifle).toBe(false);
  });

  it('applies a compare-mode override to the bullet only', () => {
    const override: CompareLoad = {
      id: 'cmp',
      label: '.308 175 SMK',
      bcType: 'G1',
      bcValue: 0.505,
      weight: 175,
      diameter: 0.308,
      bulletLength: 1.24,
      muzzleVelocity: 2600,
    };
    const input = toSolveInput(form, override);
    expect(input.bullet.massKg).toBeCloseTo(175 * KG_PER_GRAIN, 12);
    expect(input.bullet.drag.id).toBe('G1:0.505');
    expect(input.muzzleVelocityMps).toBeCloseTo(2600 * 0.3048, 9);
    // The rifle, zero and conditions are shared.
    expect(input.rifle.sightHeightM).toBeCloseTo(1.9 * METERS_PER_INCH, 12);
    expect(input.zero.rangeM).toBeCloseTo(100 * METERS_PER_YARD, 12);
  });

  it('keeps an override bullet length of null out of the input', () => {
    const override: CompareLoad = {
      id: 'cmp',
      label: 'unknown length',
      bcType: 'G7',
      bcValue: 0.3,
      weight: 140,
      diameter: 0.264,
      bulletLength: null,
      muzzleVelocity: 2700,
    };
    expect('lengthM' in toSolveInput(form, override).bullet).toBe(false);
  });

  it('passes a non-zero zero offset through', () => {
    const input = toSolveInput({ ...form, zeroOffset: 0.5 });
    expect(input.zero.offsetM).toBeCloseTo(0.5 * METERS_PER_INCH, 12);
  });
});

describe('atmosphere mapping', () => {
  it('converts the current conditions', () => {
    const atmosphere = currentAtmosphere(form);
    expect(atmosphere.temperatureK).toBeCloseTo(convertTemperature(59, 'F', 'K'), 9);
    expect(atmosphere.pressurePa).toBeCloseTo(29.92 * PA_PER_INHG, 6);
    expect(atmosphere.pressureType).toBe('baro');
    expect(atmosphere.relativeHumidity).toBeCloseTo(0.5, 12);
  });

  it('clamps humidity into 0-1 instead of passing a nonsense fraction', () => {
    expect(currentAtmosphere({ ...form, humidity: 140 }).relativeHumidity).toBe(1);
    expect(currentAtmosphere({ ...form, humidity: -20 }).relativeHumidity).toBe(0);
  });

  it('returns no zero atmosphere unless one was asked for', () => {
    expect(zeroAtmosphere(form)).toBeNull();
  });

  it('builds the zero atmosphere from the zero temperature and altitude', () => {
    const zeroed: CalcForm = {
      ...form,
      useZeroAtmosphere: true,
      zeroTemperature: 20,
      zeroAltitude: 5000,
    };
    const atmosphere = zeroAtmosphere(zeroed);
    expect(atmosphere?.temperatureK).toBeCloseTo(convertTemperature(20, 'F', 'K'), 9);
    expect(atmosphere?.altitudeM).toBeCloseTo(5000 * 0.3048, 6);
    // Pressure is reused from the current reading; see the note in map.ts.
    expect(atmosphere?.pressurePa).toBeCloseTo(29.92 * PA_PER_INHG, 6);
  });
});

describe('wind mapping', () => {
  it('maps the clock face to the engine angle', () => {
    expect(windFrom({ ...form, windFromClock: 12 }).fromRad).toBeCloseTo(0, 12);
    expect(windFrom({ ...form, windFromClock: 3 }).fromRad).toBeCloseTo(Math.PI / 2, 12);
    expect(windFrom({ ...form, windFromClock: 6 }).fromRad).toBeCloseTo(Math.PI, 12);
  });

  it('converts metric wind speeds', () => {
    const metric: CalcForm = { ...form, units: METRIC_UNITS, windSpeed: 5 };
    expect(windFrom(metric).speedMps).toBeCloseTo(5, 12);
  });
});

describe('rangeListM', () => {
  it('generates steps in the display unit and converts after', () => {
    const { rangesM, truncated } = rangeListM(form);
    expect(rangesM).toHaveLength(11);
    expect(rangesM[0]).toBe(0);
    expect(rangesM[10]).toBeCloseTo(1000 * METERS_PER_YARD, 9);
    expect(truncated).toBe(false);
  });

  it('caps a runaway request and says so', () => {
    const { rangesM, truncated } = rangeListM({
      ...form,
      rangeStart: 0,
      rangeEnd: 2000,
      rangeStep: 1,
    });
    expect(rangesM).toHaveLength(400);
    expect(truncated).toBe(true);
  });

  it('returns nothing for an impossible request', () => {
    expect(rangeListM({ ...form, rangeStep: 0 }).rangesM).toEqual([]);
    expect(rangeListM({ ...form, rangeStart: 500, rangeEnd: 100 }).rangesM).toEqual([]);
  });
});

describe('toDopeOptions', () => {
  it('carries the turret setup and converts the hold speeds', () => {
    const options = toDopeOptions(form);
    expect(options.unit).toBe('mil');
    expect(options.elevationClick).toEqual({ value: 0.1, unit: 'mil' });
    expect(options.rounding).toBe('nearest');
    expect(options.windSpeedsMps[0]).toBeCloseTo(5 * MPS_PER_MPH, 12);
    expect(options.windSpeedsMps[1]).toBeCloseTo(10 * MPS_PER_MPH, 12);
  });
});
