import { describe, expect, it } from 'vitest';
import {
  JOULES_PER_FOOT_POUND,
  KGM2_PER_LBIN2,
  RAD_PER_IPHY,
  RAD_PER_MOA,
  bcFromSI,
  bcToSI,
  convertAngle,
  convertEnergy,
  convertLength,
  convertMass,
  convertPressure,
  convertTemperature,
  convertVelocity,
  footPoundsFromGrainsFps,
  type AngleUnit,
  type EnergyUnit,
  type LengthUnit,
  type MassUnit,
  type PressureUnit,
  type TemperatureUnit,
  type VelocityUnit,
} from '../src/units';

function roundTrips<U extends string>(
  units: readonly U[],
  convert: (v: number, from: U, to: U) => number,
): void {
  for (const from of units) {
    for (const to of units) {
      const value = 123.456;
      expect(convert(convert(value, from, to), to, from)).toBeCloseTo(value, 9);
    }
  }
}

describe('unit round-trips', () => {
  it('length', () => roundTrips<LengthUnit>(['m', 'cm', 'mm', 'in', 'ft', 'yd'], convertLength));
  it('velocity', () => roundTrips<VelocityUnit>(['mps', 'fps', 'mph', 'kph'], convertVelocity));
  it('mass', () => roundTrips<MassUnit>(['kg', 'g', 'gr', 'lb'], convertMass));
  it('pressure', () =>
    roundTrips<PressureUnit>(['Pa', 'hPa', 'mbar', 'inHg', 'mmHg', 'psi'], convertPressure));
  it('energy', () => roundTrips<EnergyUnit>(['J', 'ftlbf'], convertEnergy));
  it('angle', () => roundTrips<AngleUnit>(['rad', 'deg', 'moa', 'mil', 'iphy'], convertAngle));
  it('temperature', () => roundTrips<TemperatureUnit>(['K', 'C', 'F'], convertTemperature));
  it('ballistic coefficient', () => expect(bcFromSI(bcToSI(0.315))).toBeCloseTo(0.315, 12));
});

describe('unit definitions', () => {
  it('uses exact length definitions', () => {
    expect(convertLength(1, 'yd', 'in')).toBeCloseTo(36, 12);
    expect(convertLength(1, 'in', 'mm')).toBeCloseTo(25.4, 12);
    expect(convertLength(1, 'ft', 'm')).toBe(0.3048);
  });

  it('converts velocity', () => {
    expect(convertVelocity(1, 'mph', 'fps')).toBeCloseTo(22 / 15, 12);
    expect(convertVelocity(36, 'kph', 'mps')).toBeCloseTo(10, 12);
  });

  it('converts 7000 grains to one pound', () => {
    expect(convertMass(7000, 'gr', 'lb')).toBeCloseTo(1, 12);
  });

  it('converts temperature fixed points', () => {
    expect(convertTemperature(32, 'F', 'C')).toBeCloseTo(0, 12);
    expect(convertTemperature(212, 'F', 'C')).toBeCloseTo(100, 12);
    expect(convertTemperature(-40, 'C', 'F')).toBeCloseTo(-40, 12);
    expect(convertTemperature(0, 'C', 'K')).toBe(273.15);
  });

  it('converts pressure', () => {
    expect(convertPressure(1013.25, 'hPa', 'Pa')).toBeCloseTo(101_325, 9);
    expect(convertPressure(1, 'mbar', 'hPa')).toBe(1);
    expect(convertPressure(29.92, 'inHg', 'hPa')).toBeCloseTo(1013.2, 1);
    expect(convertPressure(14.6959, 'psi', 'Pa')).toBeCloseTo(101_325, -1);
  });

  it('true MOA subtends ≈1.047 in at 100 yd; IPHY exactly 1 in', () => {
    const hundredYdIn = 3600;
    expect(Math.tan(RAD_PER_MOA) * hundredYdIn).toBeCloseTo(1.0472, 4);
    expect(Math.tan(RAD_PER_IPHY) * hundredYdIn).toBeCloseTo(1, 12);
    expect(convertAngle(1, 'mil', 'moa')).toBeCloseTo(3.4377, 4);
    expect(convertAngle(60, 'moa', 'deg')).toBeCloseTo(1, 12);
  });

  it('1 mil at 100 m is 10 cm', () => {
    expect(Math.tan(convertAngle(1, 'mil', 'rad')) * 100).toBeCloseTo(0.1, 6);
  });

  it('BC constant is 703.0696 kg/m² per lb/in²', () => {
    expect(KGM2_PER_LBIN2).toBe(703.0696);
    expect(bcToSI(1)).toBe(703.0696);
  });

  it('energy: traditional ft-lbf formula agrees with SI ½mv²', () => {
    const gr = 140;
    const v = 2700;
    const si = 0.5 * convertMass(gr, 'gr', 'kg') * convertVelocity(v, 'fps', 'mps') ** 2;
    const traditional = footPoundsFromGrainsFps(gr, v) * JOULES_PER_FOOT_POUND;
    expect(Math.abs(traditional / si - 1)).toBeLessThan(1e-3);
  });
});
