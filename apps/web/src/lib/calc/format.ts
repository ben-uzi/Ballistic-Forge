import {
  convertAngle,
  convertEnergy,
  convertLength,
  convertVelocity,
  type AngularUnit,
  type Correction,
} from '@bf/engine';
import type { EnergyUnit, FormUnits, RangeUnit, SmallLengthUnit, VelocityUnit } from './types';

/** Fixed decimals, with a true minus sign so columns line up under tabular numerals. */
function fixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  const text = value.toFixed(digits);
  // Avoid "-0.0".
  return text.replace(/^-(0(?:\.0*)?)$/, '$1');
}

export const UNIT_LABEL = {
  yd: 'yd',
  m: 'm',
  fps: 'fps',
  mps: 'm/s',
  ftlbf: 'ft·lb',
  J: 'J',
  in: 'in',
  cm: 'cm',
  mm: 'mm',
  mil: 'mil',
  moa: 'MOA',
  iphy: 'IPHY',
  F: '°F',
  C: '°C',
  inHg: 'inHg',
  hPa: 'hPa',
  ft: 'ft',
  gr: 'gr',
  g: 'g',
  mph: 'mph',
  kph: 'km/h',
} as const;

export function fmtRange(metres: number, unit: RangeUnit): string {
  return fixed(convertLength(metres, 'm', unit), 0);
}

export function fmtVelocity(mps: number, unit: VelocityUnit): string {
  return fixed(convertVelocity(mps, 'mps', unit), 0);
}

export function fmtEnergy(joules: number, unit: EnergyUnit): string {
  return fixed(convertEnergy(joules, 'J', unit), 0);
}

/** The drop/path column: inches for imperial users, centimetres for metric. */
export function dropUnitFor(smallLength: SmallLengthUnit): 'in' | 'cm' {
  return smallLength === 'in' ? 'in' : 'cm';
}

export function fmtDrop(metres: number, smallLength: SmallLengthUnit): string {
  return fixed(convertLength(metres, 'm', dropUnitFor(smallLength)), 1);
}

/** Mil turrets read to 0.1; MOA turrets to 0.25 — so MOA gets the extra digit. */
export function angleDigits(unit: AngularUnit): number {
  return unit === 'mil' ? 1 : 2;
}

export function fmtAngle(rad: number, unit: AngularUnit): string {
  return fixed(convertAngle(rad, 'rad', unit), angleDigits(unit));
}

/** "2.3 U" — the value, then the direction to dial. */
export function fmtCorrection(correction: Correction, unit: AngularUnit): string {
  const magnitude = fixed(Math.abs(correction.value), angleDigits(unit));
  return correction.direction === null ? magnitude : `${magnitude} ${correction.direction}`;
}

/** "23 U" — whole clicks. */
export function fmtClicks(correction: Correction): string {
  const clicks = Math.abs(correction.clicks);
  return correction.direction === null ? `${clicks}` : `${clicks} ${correction.direction}`;
}

export function fmtTime(seconds: number): string {
  return fixed(seconds, 2);
}

export function fmtMach(mach: number): string {
  return fixed(mach, 2);
}

export function fmtDensityAltitude(metres: number, unit: FormUnits['altitude']): string {
  return `${fixed(convertLength(metres, 'm', unit), 0)} ${UNIT_LABEL[unit]}`;
}

export function fmtStability(sg: number | null): string {
  return sg === null ? 'unknown' : fixed(sg, 2);
}

export const REGIME_LABEL = {
  supersonic: 'Supersonic',
  transonic: 'Transonic',
  subsonic: 'Subsonic',
} as const;
