/**
 * Unit conversions. All engine math is SI (m, s, kg, K, Pa, rad); convert only at the edges.
 */

export const METERS_PER_INCH = 0.0254;
export const METERS_PER_FOOT = 0.3048;
export const METERS_PER_YARD = 0.9144;
export const KG_PER_GRAIN = 0.00006479891;
export const KG_PER_POUND = 0.45359237;
export const PA_PER_INHG = 3386.389;
export const PA_PER_MMHG = 133.322387415;
export const PA_PER_PSI = 6894.757293168;
/** Exact: 1 lbf = 4.4482216152605 N. */
export const NEWTONS_PER_POUND_FORCE = 4.4482216152605;
export const JOULES_PER_FOOT_POUND = METERS_PER_FOOT * NEWTONS_PER_POUND_FORCE;
export const MPS_PER_MPH = 0.44704;
/** Ballistic coefficient: 1 lb/in² = 703.0696 kg/m². */
export const KGM2_PER_LBIN2 = 703.0696;

/** True minute of angle: 1/60 degree (≈ 1.047 in at 100 yd). */
export const RAD_PER_MOA = Math.PI / 10800;
/** Milliradian. */
export const RAD_PER_MIL = 0.001;
/** Inches per hundred yards ("shooter's MOA"): exactly 1 in at 100 yd. */
export const RAD_PER_IPHY = Math.atan(METERS_PER_INCH / (100 * METERS_PER_YARD));

export type LengthUnit = 'm' | 'cm' | 'mm' | 'in' | 'ft' | 'yd';
export type VelocityUnit = 'mps' | 'fps' | 'mph' | 'kph';
export type MassUnit = 'kg' | 'g' | 'gr' | 'lb';
export type PressureUnit = 'Pa' | 'hPa' | 'mbar' | 'inHg' | 'mmHg' | 'psi';
export type EnergyUnit = 'J' | 'ftlbf';
export type AngleUnit = 'rad' | 'deg' | 'moa' | 'mil' | 'iphy';
export type TemperatureUnit = 'K' | 'C' | 'F';

const LENGTH: Readonly<Record<LengthUnit, number>> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: METERS_PER_INCH,
  ft: METERS_PER_FOOT,
  yd: METERS_PER_YARD,
};

const VELOCITY: Readonly<Record<VelocityUnit, number>> = {
  mps: 1,
  fps: METERS_PER_FOOT,
  mph: MPS_PER_MPH,
  kph: 1 / 3.6,
};

const MASS: Readonly<Record<MassUnit, number>> = {
  kg: 1,
  g: 0.001,
  gr: KG_PER_GRAIN,
  lb: KG_PER_POUND,
};

const PRESSURE: Readonly<Record<PressureUnit, number>> = {
  Pa: 1,
  hPa: 100,
  mbar: 100,
  inHg: PA_PER_INHG,
  mmHg: PA_PER_MMHG,
  psi: PA_PER_PSI,
};

const ENERGY: Readonly<Record<EnergyUnit, number>> = {
  J: 1,
  ftlbf: JOULES_PER_FOOT_POUND,
};

const ANGLE: Readonly<Record<AngleUnit, number>> = {
  rad: 1,
  deg: Math.PI / 180,
  moa: RAD_PER_MOA,
  mil: RAD_PER_MIL,
  iphy: RAD_PER_IPHY,
};

function linear<U extends string>(factors: Readonly<Record<U, number>>) {
  return (value: number, from: U, to: U): number => (value * factors[from]) / factors[to];
}

export const convertLength = linear(LENGTH);
export const convertVelocity = linear(VELOCITY);
export const convertMass = linear(MASS);
export const convertPressure = linear(PRESSURE);
export const convertEnergy = linear(ENERGY);
export const convertAngle = linear(ANGLE);

function toKelvin(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'K':
      return value;
    case 'C':
      return value + 273.15;
    case 'F':
      return ((value - 32) * 5) / 9 + 273.15;
  }
}

function fromKelvin(kelvin: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'K':
      return kelvin;
    case 'C':
      return kelvin - 273.15;
    case 'F':
      return ((kelvin - 273.15) * 9) / 5 + 32;
  }
}

export function convertTemperature(
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit,
): number {
  return fromKelvin(toKelvin(value, from), to);
}

/** G1/G7 ballistic coefficient as published (lb/in²) → SI (kg/m²). */
export const bcToSI = (bcLbPerIn2: number): number => bcLbPerIn2 * KGM2_PER_LBIN2;

/** SI ballistic coefficient (kg/m²) → lb/in². */
export const bcFromSI = (bcKgPerM2: number): number => bcKgPerM2 / KGM2_PER_LBIN2;

/** Traditional US energy formula: ft-lbf = weight(gr) × velocity(fps)² / 450,240. */
export const footPoundsFromGrainsFps = (weightGr: number, velocityFps: number): number =>
  (weightGr * velocityFps * velocityFps) / 450_240;
