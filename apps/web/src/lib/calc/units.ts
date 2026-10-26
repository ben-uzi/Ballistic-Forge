import {
  convertLength,
  convertMass,
  convertPressure,
  convertTemperature,
  convertVelocity,
  type LengthUnit,
} from '@bf/engine';
import type { CalcForm, CompareLoad, FormUnits } from './types';

/**
 * Display precision per quantity. Switching units must not invent precision
 * (2690 fps → 819.912 m/s) nor destroy it (0.264 in → 7 mm).
 */
const DIGITS: Readonly<Record<string, number>> = {
  yd: 0,
  m: 0,
  fps: 0,
  mps: 1,
  F: 0,
  C: 1,
  inHg: 2,
  hPa: 0,
  ft: 0,
  in: 3,
  mm: 2,
  gr: 1,
  g: 3,
  mph: 1,
  kph: 1,
};

function round(value: number, unit: string): number {
  const digits = DIGITS[unit] ?? 2;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const mapLength =
  (from: LengthUnit, to: LengthUnit) =>
  (value: number): number =>
    round(convertLength(value, from, to), to);

/**
 * Re-express a form in different units, preserving the physical quantity.
 *
 * Only the fields belonging to a changed unit are touched, so switching the
 * range unit never perturbs the bullet weight the user typed.
 */
export function withUnits(form: CalcForm, next: Partial<FormUnits>): CalcForm {
  const units: FormUnits = { ...form.units, ...next };
  const old = form.units;
  let result: CalcForm = { ...form, units };

  if (units.smallLength !== old.smallLength) {
    const convert = mapLength(old.smallLength, units.smallLength);
    result = {
      ...result,
      diameter: convert(result.diameter),
      bulletLength: result.bulletLength === null ? null : convert(result.bulletLength),
      sightHeight: convert(result.sightHeight),
      twist: result.twist === null ? null : convert(result.twist),
      zeroOffset: convert(result.zeroOffset),
    };
  }

  if (units.range !== old.range) {
    const convert = mapLength(old.range, units.range);
    result = {
      ...result,
      zeroRange: convert(result.zeroRange),
      rangeStart: convert(result.rangeStart),
      rangeEnd: convert(result.rangeEnd),
      rangeStep: Math.max(1, convert(result.rangeStep)),
    };
  }

  if (units.altitude !== old.altitude) {
    const convert = mapLength(old.altitude, units.altitude);
    result = {
      ...result,
      altitude: convert(result.altitude),
      zeroAltitude: convert(result.zeroAltitude),
    };
  }

  if (units.mass !== old.mass) {
    result = {
      ...result,
      weight: round(convertMass(result.weight, old.mass, units.mass), units.mass),
    };
  }

  if (units.velocity !== old.velocity) {
    result = {
      ...result,
      muzzleVelocity: round(
        convertVelocity(result.muzzleVelocity, old.velocity, units.velocity),
        units.velocity,
      ),
    };
  }

  if (units.temperature !== old.temperature) {
    const convert = (value: number): number =>
      round(convertTemperature(value, old.temperature, units.temperature), units.temperature);
    result = {
      ...result,
      temperature: convert(result.temperature),
      zeroTemperature: convert(result.zeroTemperature),
    };
  }

  if (units.pressure !== old.pressure) {
    result = {
      ...result,
      pressure: round(
        convertPressure(result.pressure, old.pressure, units.pressure),
        units.pressure,
      ),
    };
  }

  if (units.windSpeed !== old.windSpeed) {
    const convert = (value: number): number =>
      round(convertVelocity(value, old.windSpeed, units.windSpeed), units.windSpeed);
    result = {
      ...result,
      windSpeed: convert(result.windSpeed),
      windHoldSpeeds: result.windHoldSpeeds.map(convert),
    };
  }

  return result;
}

/** The same conversion for a compare-mode load, which shares the form's units. */
export function compareLoadWithUnits(
  load: CompareLoad,
  from: FormUnits,
  to: FormUnits,
): CompareLoad {
  const length = mapLength(from.smallLength, to.smallLength);
  return {
    ...load,
    diameter: from.smallLength === to.smallLength ? load.diameter : length(load.diameter),
    bulletLength:
      load.bulletLength === null || from.smallLength === to.smallLength
        ? load.bulletLength
        : length(load.bulletLength),
    weight:
      from.mass === to.mass
        ? load.weight
        : round(convertMass(load.weight, from.mass, to.mass), to.mass),
    muzzleVelocity:
      from.velocity === to.velocity
        ? load.muzzleVelocity
        : round(convertVelocity(load.muzzleVelocity, from.velocity, to.velocity), to.velocity),
  };
}
