import {
  CLICK_VALUES,
  clockToRad,
  convertLength,
  convertMass,
  convertPressure,
  convertTemperature,
  convertVelocity,
  rangeSteps,
  standardDragModel,
  type AtmosphereInput,
  type Bullet,
  type ClickValue,
  type CoriolisInput,
  type DopeOptions,
  type Rifle,
  type SolveInput,
  type SolveOptions,
  type Wind,
  type ZeroSpec,
} from '@bf/engine';
import { MAX_ROWS } from './defaults';
import type { CalcForm, CompareLoad } from './types';

const DEG_TO_RAD = Math.PI / 180;

export function clickValue(key: CalcForm['elevationClickKey']): ClickValue {
  return CLICK_VALUES[key];
}

/**
 * The ranges to report, in metres.
 *
 * Steps are generated in the user's display unit and then converted, so a
 * request for "every 100 yd" lands on exact hundreds rather than 91.44 m
 * accumulating rounding error. Returns `truncated` when the request was capped.
 */
export function rangeListM(form: CalcForm): { rangesM: number[]; truncated: boolean } {
  const { rangeStart, rangeEnd, rangeStep, units } = form;
  if (!(rangeStep > 0) || rangeEnd < rangeStart) return { rangesM: [], truncated: false };

  const all = rangeSteps(rangeStart, rangeEnd, rangeStep);
  const truncated = all.length > MAX_ROWS;
  const kept = truncated ? all.slice(0, MAX_ROWS) : all;
  return { rangesM: kept.map((r) => convertLength(r, units.range, 'm')), truncated };
}

function atmosphereInput(
  temperature: number,
  pressure: number,
  altitude: number,
  humidityPercent: number,
  form: CalcForm,
): AtmosphereInput {
  const { units } = form;
  return {
    temperatureK: convertTemperature(temperature, units.temperature, 'K'),
    pressurePa: convertPressure(pressure, units.pressure, 'Pa'),
    pressureType: form.pressureType,
    altitudeM: convertLength(altitude, units.altitude, 'm'),
    relativeHumidity: clamp(humidityPercent, 0, 100) / 100,
  };
}

export function currentAtmosphere(form: CalcForm): AtmosphereInput {
  return atmosphereInput(form.temperature, form.pressure, form.altitude, form.humidity, form);
}

/**
 * The atmosphere at the time of zeroing. Pressure is reused from the current
 * reading: shooters remember the temperature and altitude they zeroed at far
 * more often than the barometer, and those two dominate the density change.
 */
export function zeroAtmosphere(form: CalcForm): AtmosphereInput | null {
  if (!form.useZeroAtmosphere) return null;
  return atmosphereInput(
    form.zeroTemperature,
    form.pressure,
    form.zeroAltitude,
    form.humidity,
    form,
  );
}

export function windFrom(form: CalcForm): Wind {
  return {
    speedMps: convertVelocity(form.windSpeed, form.units.windSpeed, 'mps'),
    fromRad: clockToRad(form.windFromClock),
  };
}

/**
 * Map the form onto the engine's input. `override` replaces the load-specific
 * fields, which is how compare mode runs three bullets through one rifle and
 * one set of conditions.
 */
export function toSolveInput(form: CalcForm, override?: CompareLoad): SolveInput {
  const { units } = form;

  const bcType = override?.bcType ?? form.bcType;
  const bcValue = override?.bcValue ?? form.bcValue;
  const weight = override?.weight ?? form.weight;
  const diameter = override?.diameter ?? form.diameter;
  const bulletLength = override ? override.bulletLength : form.bulletLength;
  const muzzleVelocity = override?.muzzleVelocity ?? form.muzzleVelocity;

  const lengthM =
    bulletLength === null ? null : convertLength(bulletLength, units.smallLength, 'm');
  const bullet: Bullet = {
    massKg: convertMass(weight, units.mass, 'kg'),
    diameterM: convertLength(diameter, units.smallLength, 'm'),
    drag: standardDragModel(bcType, bcValue),
    ...(lengthM === null ? {} : { lengthM }),
  };

  const twistM = form.twist === null ? null : convertLength(form.twist, units.smallLength, 'm');
  const rifle: Rifle = {
    sightHeightM: convertLength(form.sightHeight, units.smallLength, 'm'),
    twistDirection: form.twistDirection,
    ...(twistM === null ? {} : { twistM }),
  };

  const zeroAtmo = zeroAtmosphere(form);
  const offsetM = convertLength(form.zeroOffset, units.smallLength, 'm');
  const zero: ZeroSpec = {
    rangeM: convertLength(form.zeroRange, units.range, 'm'),
    ...(offsetM === 0 ? {} : { offsetM }),
    ...(zeroAtmo === null ? {} : { atmosphere: zeroAtmo }),
  };

  const options: SolveOptions = {
    spinDrift: form.spinDriftEnabled,
    aerodynamicJump: form.aerodynamicJumpEnabled,
  };

  const coriolis: CoriolisInput = {
    latitudeRad: form.latitudeDeg * DEG_TO_RAD,
    azimuthRad: form.azimuthDeg * DEG_TO_RAD,
  };

  const wind = windFrom(form);
  const inclineRad = form.inclineDeg * DEG_TO_RAD;

  return {
    bullet,
    rifle,
    zero,
    muzzleVelocityMps: convertVelocity(muzzleVelocity, units.velocity, 'mps'),
    atmosphere: currentAtmosphere(form),
    ranges: rangeListM(form).rangesM,
    options,
    ...(wind.speedMps === 0 ? {} : { wind }),
    ...(inclineRad === 0 ? {} : { inclineRad }),
    ...(form.coriolisEnabled ? { coriolis } : {}),
  };
}

export function toDopeOptions(form: CalcForm): DopeOptions {
  return {
    unit: form.units.angular,
    elevationClick: clickValue(form.elevationClickKey),
    windageClick: clickValue(form.windageClickKey),
    rounding: form.rounding,
    windSpeedsMps: form.windHoldSpeeds.map((s) => convertVelocity(s, form.units.windSpeed, 'mps')),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
