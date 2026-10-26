import { describe, expect, it } from 'vitest';
import type { AtmosphereInput } from '../src/atmosphere';
import { ICAO_STANDARD_ATMOSPHERE } from '../src/atmosphere';
import type { SolveInput } from '../src/solver';
import { BallisticsInputError, validateSolveInput, validateStandardBc } from '../src/validation';
import { deg, fps, inch, syntheticInput, yd } from './helpers';

const codes = (input: SolveInput) => validateSolveInput(input).map((i) => `${i.path}:${i.code}`);
const atm = (o: Partial<AtmosphereInput>): AtmosphereInput => ({
  ...ICAO_STANDARD_ATMOSPHERE,
  ...o,
});
const bullet = (o: Partial<SolveInput['bullet']>) => ({ ...syntheticInput().bullet, ...o });

describe('validateSolveInput', () => {
  it('accepts a sane profile with no issues', () => {
    expect(validateSolveInput(syntheticInput())).toEqual([]);
  });

  it('suggests the decimal for a sight height entered ×10', () => {
    const [issue] = validateSolveInput(syntheticInput({ rifle: { sightHeightM: inch(25) } }));
    expect(issue?.message).toBe('Sight height of 25 in looks wrong — did you mean 2.5 in?');
    expect(issue?.severity).toBe('error');
  });

  it('flags other sight height problems', () => {
    expect(codes(syntheticInput({ rifle: { sightHeightM: inch(80) } }))).toEqual([
      'rifle.sightHeightM:out-of-range',
    ]);
    expect(
      validateSolveInput(syntheticInput({ rifle: { sightHeightM: inch(80) } }))[0]?.message,
    ).toMatch(/wrong\.$/);
    expect(codes(syntheticInput({ rifle: { sightHeightM: -0.01 } }))).toEqual([
      'rifle.sightHeightM:negative',
    ]);
    expect(codes(syntheticInput({ rifle: { sightHeightM: inch(4.5) } }))).toEqual([
      'rifle.sightHeightM:unusual',
    ]);
  });

  it('catches millimetres typed as inches for diameter', () => {
    const [issue] = validateSolveInput(
      syntheticInput({ bullet: bullet({ diameterM: inch(6.5) }) }),
    );
    expect(issue?.code).toBe('looks-like-mm');
    expect(issue?.message).toContain('did you mean 0.256 in (6.5 mm)');
  });

  it('flags unusual bullets', () => {
    expect(codes(syntheticInput({ bullet: bullet({ diameterM: inch(0.6) }) }))).toEqual([
      'bullet.diameterM:unusual',
    ]);
    expect(codes(syntheticInput({ bullet: bullet({ massKg: 0.0001 }) }))).toEqual([
      'bullet.massKg:unusual',
    ]);
    expect(codes(syntheticInput({ bullet: bullet({ lengthM: inch(0.2) }) }))).toEqual([
      'bullet.lengthM:unusual',
    ]);
    expect(codes(syntheticInput({ bullet: bullet({ massKg: 0 }) }))).toEqual([
      'bullet.massKg:not-positive',
    ]);
    expect(codes(syntheticInput({ bullet: bullet({ lengthM: Number.NaN }) }))).toEqual([
      'bullet.lengthM:not-a-number',
    ]);
  });

  it('flags implausible muzzle velocities', () => {
    expect(validateSolveInput(syntheticInput({ muzzleVelocityMps: 2700 }))[0]?.message).toContain(
      'check the units',
    );
    expect(codes(syntheticInput({ muzzleVelocityMps: fps(400) }))).toEqual([
      'muzzleVelocityMps:unusual',
    ]);
  });

  it('flags twist, zero range and zero offset problems', () => {
    expect(codes(syntheticInput({ rifle: { sightHeightM: inch(1.9), twistM: inch(40) } }))).toEqual(
      ['rifle.twistM:unusual'],
    );
    expect(codes(syntheticInput({ zero: { rangeM: 2 } }))).toEqual(['zero.rangeM:out-of-range']);
    expect(codes(syntheticInput({ zero: { rangeM: yd(700) } }))).toEqual(['zero.rangeM:unusual']);
    expect(codes(syntheticInput({ zero: { rangeM: yd(100), offsetM: inch(20) } }))).toEqual([
      'zero.offsetM:unusual',
    ]);
    expect(codes(syntheticInput({ zero: { rangeM: yd(100), muzzleVelocityMps: -1 } }))).toEqual([
      'zero.muzzleVelocityMps:not-positive',
    ]);
  });

  it('validates the current and zero atmospheres', () => {
    expect(codes(syntheticInput({ atmosphere: atm({ temperatureK: 400 }) }))).toEqual([
      'atmosphere.temperatureK:out-of-range',
    ]);
    expect(codes(syntheticInput({ atmosphere: atm({ pressurePa: 20_000 }) }))).toEqual([
      'atmosphere.pressurePa:out-of-range',
    ]);
    expect(codes(syntheticInput({ atmosphere: atm({ altitudeM: 12_000 }) }))).toEqual([
      'atmosphere.altitudeM:out-of-range',
    ]);
    expect(codes(syntheticInput({ atmosphere: atm({ relativeHumidity: -0.2 }) }))).toEqual([
      'atmosphere.relativeHumidity:out-of-range',
    ]);
    expect(
      codes(
        syntheticInput({
          zero: { rangeM: yd(100), atmosphere: atm({ temperatureK: Number.NaN }) },
        }),
      ),
    ).toEqual(['zero.atmosphere.temperatureK:not-a-number']);
  });

  it('catches station pressure entered as barometric', () => {
    const [issue] = validateSolveInput(
      syntheticInput({
        atmosphere: atm({ pressureType: 'baro', pressurePa: 84_000, altitudeM: 1600 }),
      }),
    );
    expect(issue?.code).toBe('baro-looks-like-station');
    expect(issue?.message).toContain('Switch the pressure type to Station');
  });

  it('catches humidity as a percentage', () => {
    const [issue] = validateSolveInput(
      syntheticInput({ atmosphere: atm({ relativeHumidity: 45 }) }),
    );
    expect(issue?.code).toBe('percent-not-fraction');
    expect(issue?.message).toContain('pass 0.45');
  });

  it('validates wind, incline and Coriolis', () => {
    expect(codes(syntheticInput({ wind: { speedMps: -1, fromRad: 0 } }))).toEqual([
      'wind.speedMps:negative',
    ]);
    expect(codes(syntheticInput({ wind: { speedMps: 60, fromRad: 0 } }))).toEqual([
      'wind.speedMps:out-of-range',
    ]);
    expect(codes(syntheticInput({ wind: { speedMps: 20, fromRad: 0 } }))).toEqual([
      'wind.speedMps:unusual',
    ]);
    expect(codes(syntheticInput({ wind: { speedMps: 2, fromRad: Number.NaN } }))).toEqual([
      'wind.fromRad:not-a-number',
    ]);
    expect(codes(syntheticInput({ inclineRad: deg(85) }))).toEqual(['inclineRad:out-of-range']);
    expect(codes(syntheticInput({ inclineRad: deg(-50) }))).toEqual(['inclineRad:unusual']);
    expect(codes(syntheticInput({ coriolis: { latitudeRad: deg(95), azimuthRad: 0 } }))).toEqual([
      'coriolis.latitudeRad:out-of-range',
    ]);
    expect(
      codes(syntheticInput({ coriolis: { latitudeRad: 0, azimuthRad: Number.POSITIVE_INFINITY } })),
    ).toEqual(['coriolis.azimuthRad:not-a-number']);
  });

  it('validates ranges and time step', () => {
    expect(codes(syntheticInput({ ranges: [] }))).toEqual(['ranges:empty']);
    expect(codes(syntheticInput({ ranges: [100, -5, Number.NaN] }))).toEqual([
      'ranges.1:out-of-range',
      'ranges.2:not-a-number',
    ]);
    expect(codes(syntheticInput({ options: { dtS: 0.1 } }))).toEqual(['options.dtS:out-of-range']);
  });
});

describe('BallisticsInputError', () => {
  it('carries all issues and joins only error messages', () => {
    const issues = validateSolveInput(
      syntheticInput({ rifle: { sightHeightM: inch(25) }, muzzleVelocityMps: fps(400) }),
    );
    const err = new BallisticsInputError(issues);
    expect(err.issues).toHaveLength(2);
    expect(err.message).toBe('Sight height of 25 in looks wrong — did you mean 2.5 in?');
    expect(err.name).toBe('BallisticsInputError');
  });
});

describe('validateStandardBc', () => {
  it('accepts plausible BCs', () => {
    expect(validateStandardBc('G1', 0.6)).toEqual([]);
    expect(validateStandardBc('G7', 0.3)).toEqual([]);
  });

  it('hints when a G1 value is entered as G7', () => {
    expect(validateStandardBc('G7', 0.9)[0]?.message).toContain('Is this a G1 value?');
  });

  it('rejects impossible BCs', () => {
    expect(validateStandardBc('G1', 3)[0]?.code).toBe('out-of-range');
    expect(validateStandardBc('G1', 3)[0]?.message).not.toContain('G1 value');
    expect(validateStandardBc('G1', 0)[0]?.code).toBe('not-positive');
  });
});
