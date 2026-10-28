import { convertTemperature, convertVelocity, temperatureAdjustedMuzzleVelocity } from '@bf/engine';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import type { CalcForm } from '@/lib/calc/types';
import type { StoredLoad, StoredRifle } from '@/lib/store/types';

/**
 * Turning a saved rifle + load into calculator input.
 *
 * Profiles are stored in US customary units (how they were entered); this is
 * the single place that reconciles them with whatever units the calculator is
 * currently showing.
 */

export interface MuzzleVelocity {
  readonly fps: number;
  /** Where the number came from, for the UI to label honestly. */
  readonly source: 'advertised' | 'chronograph' | 'trued' | 'estimated';
  /** fps added or removed by the powder temperature correction, 0 when none. */
  readonly temperatureAdjustmentFps: number;
  /** True when a trued value replaced the entered one. */
  readonly trued: boolean;
}

/**
 * The muzzle velocity to actually solve with.
 *
 * Order: a trued value beats the entered one, then powder temperature
 * sensitivity is applied if it is known and the measurement temperature was
 * recorded. Every step is reported so the UI can show its working rather than
 * silently changing the number the user typed.
 */
export function effectiveMuzzleVelocity(load: StoredLoad, currentTempF: number): MuzzleVelocity {
  const trued = load.truedMuzzleVelocityFps;
  const baseFps = trued?.value ?? load.muzzleVelocityFps;
  const source = trued === undefined ? load.muzzleVelocitySource : 'trued';

  const sensitivity = load.temperatureSensitivityFpsPerF;
  const measuredAt = load.muzzleVelocityAtTempF;
  if (sensitivity === undefined || measuredAt === undefined || sensitivity === 0) {
    return { fps: baseFps, source, temperatureAdjustmentFps: 0, trued: trued !== undefined };
  }

  // The engine works in SI: fps per °F becomes m/s per kelvin (1 K = 1.8 °F).
  const sensitivityMpsPerK = convertVelocity(sensitivity, 'fps', 'mps') * 1.8;
  const adjustedMps = temperatureAdjustedMuzzleVelocity(
    convertVelocity(baseFps, 'fps', 'mps'),
    convertTemperature(measuredAt, 'F', 'K'),
    convertTemperature(currentTempF, 'F', 'K'),
    sensitivityMpsPerK,
  );
  const adjustedFps = convertVelocity(adjustedMps, 'mps', 'fps');

  return {
    fps: Math.round(adjustedFps * 10) / 10,
    source,
    temperatureAdjustmentFps: Math.round((adjustedFps - baseFps) * 10) / 10,
    trued: trued !== undefined,
  };
}

/**
 * Build calculator input from a saved profile.
 *
 * `base` carries forward whatever the user already has on screen — conditions,
 * output range, unit choices — so loading a profile changes the rifle and load
 * and nothing else.
 */
export function formFromProfile(
  rifle: StoredRifle,
  load: StoredLoad,
  base: CalcForm = DEFAULT_FORM,
): CalcForm {
  // Stored values are US customary; convert the current conditions to °F to ask
  // the temperature question, then express the answer in the form's units.
  const currentTempF = convertTemperature(base.temperature, base.units.temperature, 'F');
  const mv = effectiveMuzzleVelocity(load, currentTempF);

  const inUnits = (value: number, from: keyof typeof CONVERTERS): number =>
    CONVERTERS[from](value, base);

  return {
    ...base,
    bulletName: load.bullet.name,
    diameter: inUnits(load.bullet.diameterIn, 'smallLength'),
    weight: inUnits(load.bullet.weightGr, 'mass'),
    bcType: load.bullet.bcType,
    bcValue: load.bullet.bcValue,
    bulletLength:
      load.bullet.lengthIn === undefined ? null : inUnits(load.bullet.lengthIn, 'smallLength'),
    muzzleVelocity: inUnits(mv.fps, 'velocity'),
    dataUnverified: !load.bullet.verified,

    sightHeight: inUnits(rifle.sightHeightIn, 'smallLength'),
    twist: rifle.twistIn === undefined ? null : inUnits(rifle.twistIn, 'smallLength'),
    twistDirection: rifle.twistDirection,
    zeroRange: inUnits(rifle.zeroRangeYd, 'range'),
    elevationClickKey: rifle.elevationClickKey as CalcForm['elevationClickKey'],
    windageClickKey: rifle.windageClickKey as CalcForm['windageClickKey'],
    units: { ...base.units, angular: rifle.angularUnit },
  };
}

/** Conversions from the stored US-customary unit into the form's chosen unit. */
const CONVERTERS = {
  smallLength: (value: number, form: CalcForm): number =>
    form.units.smallLength === 'in' ? value : round(value * 25.4, 2),
  mass: (value: number, form: CalcForm): number =>
    form.units.mass === 'gr' ? value : round(value * 0.06479891, 3),
  velocity: (value: number, form: CalcForm): number =>
    form.units.velocity === 'fps' ? value : round(value * 0.3048, 1),
  range: (value: number, form: CalcForm): number =>
    form.units.range === 'yd' ? value : round(value * 0.9144, 0),
} as const;

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** A one-line description of a load, for list rows and card headers. */
export function describeLoad(load: StoredLoad): string {
  return `${String(load.bullet.weightGr)} gr ${load.bullet.name} · ${load.bullet.bcType} ${String(load.bullet.bcValue)} · ${String(load.muzzleVelocityFps)} fps`;
}

export function describeRifle(rifle: StoredRifle): string {
  const parts = [rifle.cartridge].filter((part) => part !== '');
  if (rifle.barrelLengthIn !== undefined) parts.push(`${String(rifle.barrelLengthIn)} in`);
  if (rifle.twistIn !== undefined) parts.push(`1:${String(rifle.twistIn)}`);
  parts.push(`${String(rifle.zeroRangeYd)} yd zero`);
  return parts.join(' · ');
}
