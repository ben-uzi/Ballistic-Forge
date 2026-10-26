import type { ValidationIssue } from '@bf/engine';
import type { CalcForm } from './types';

type FormField = keyof CalcForm | 'bcValue';

/**
 * Engine validation paths are in SI terms (`rifle.sightHeightM`); the form is in
 * display terms (`sightHeight`). This maps one to the other so a message lands
 * under the field that caused it instead of in a list at the top.
 */
const PATH_TO_FIELD: Readonly<Record<string, FormField>> = {
  'bullet.massKg': 'weight',
  'bullet.diameterM': 'diameter',
  'bullet.lengthM': 'bulletLength',
  'rifle.sightHeightM': 'sightHeight',
  'rifle.twistM': 'twist',
  muzzleVelocityMps: 'muzzleVelocity',
  'zero.rangeM': 'zeroRange',
  'zero.offsetM': 'zeroOffset',
  'zero.muzzleVelocityMps': 'muzzleVelocity',
  'atmosphere.temperatureK': 'temperature',
  'atmosphere.pressurePa': 'pressure',
  'atmosphere.altitudeM': 'altitude',
  'atmosphere.relativeHumidity': 'humidity',
  'zero.atmosphere.temperatureK': 'zeroTemperature',
  'zero.atmosphere.altitudeM': 'zeroAltitude',
  'zero.atmosphere.pressurePa': 'pressure',
  'zero.atmosphere.relativeHumidity': 'humidity',
  'wind.speedMps': 'windSpeed',
  'wind.fromRad': 'windFromClock',
  inclineRad: 'inclineDeg',
  'coriolis.latitudeRad': 'latitudeDeg',
  'coriolis.azimuthRad': 'azimuthDeg',
  ranges: 'rangeStep',
  rangeStep: 'rangeStep',
  bc: 'bcValue',
};

export type FieldIssues = ReadonlyMap<FormField, ValidationIssue>;

/**
 * Index issues by form field, errors winning over warnings so a field never
 * shows a soft warning while it holds a hard error.
 */
export function byField(issues: readonly ValidationIssue[]): FieldIssues {
  const map = new Map<FormField, ValidationIssue>();
  for (const issue of issues) {
    const field = PATH_TO_FIELD[issue.path];
    if (field === undefined) continue;
    const existing = map.get(field);
    if (existing === undefined || (existing.severity === 'warning' && issue.severity === 'error')) {
      map.set(field, issue);
    }
  }
  return map;
}

/** Issues that did not map to a field and so must be shown on their own. */
export function unmapped(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => PATH_TO_FIELD[issue.path] === undefined);
}

export function messageFor(issues: FieldIssues, field: FormField): string | undefined {
  return issues.get(field)?.message;
}

/** Only errors block a solve; warnings are advisory. */
export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
