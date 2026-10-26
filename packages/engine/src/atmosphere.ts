import { STANDARD_GRAVITY } from './constants';
import { PA_PER_INHG, PA_PER_MMHG } from './units';

/** Ratio of specific heats for dry air. */
export const GAMMA_AIR = 1.4;
/** Specific gas constant of dry air, J/(kg·K). */
export const R_DRY_AIR = 287.05;
/** Specific gas constant of water vapor, J/(kg·K). */
export const R_WATER_VAPOR = 461.495;

const ISA_SEA_LEVEL_TEMPERATURE_K = 288.15;
const ISA_SEA_LEVEL_PRESSURE_PA = 101_325;
const ISA_LAPSE_RATE_K_PER_M = 0.0065;
const MOLAR_MASS_DRY_AIR_KG_PER_MOL = 0.0289644;
const UNIVERSAL_GAS_CONSTANT = 8.3144598;
/** g·M / (R·L) ≈ 5.2559 — exponent of the ISA troposphere pressure-altitude relation. */
const BAROMETRIC_EXPONENT =
  (STANDARD_GRAVITY * MOLAR_MASS_DRY_AIR_KG_PER_MOL) /
  (UNIVERSAL_GAS_CONSTANT * ISA_LAPSE_RATE_K_PER_M);
const ISA_SEA_LEVEL_DENSITY = ISA_SEA_LEVEL_PRESSURE_PA / (R_DRY_AIR * ISA_SEA_LEVEL_TEMPERATURE_K);

/**
 * `station`: absolute pressure measured where you stand (Kestrel "station pressure").
 * `baro`: barometric pressure corrected to sea level (what weather reports give). Needs altitude.
 */
export type PressureType = 'station' | 'baro';

export interface AtmosphereInput {
  readonly temperatureK: number;
  readonly pressurePa: number;
  readonly pressureType: PressureType;
  readonly altitudeM: number;
  /** Fraction 0–1. */
  readonly relativeHumidity: number;
}

export interface Atmosphere {
  readonly temperatureK: number;
  readonly stationPressurePa: number;
  readonly relativeHumidity: number;
  readonly altitudeM: number;
  readonly vaporPressurePa: number;
  readonly densityKgM3: number;
  readonly speedOfSoundMps: number;
  readonly densityAltitudeM: number;
}

/** ICAO standard atmosphere at sea level: 15 °C, 101,325 Pa, 0% RH. */
export const ICAO_STANDARD_ATMOSPHERE: AtmosphereInput = {
  temperatureK: ISA_SEA_LEVEL_TEMPERATURE_K,
  pressurePa: ISA_SEA_LEVEL_PRESSURE_PA,
  pressureType: 'station',
  altitudeM: 0,
  relativeHumidity: 0,
};

/**
 * Army Standard Metro: 59 °F, 750 mmHg (29.5275 inHg), 78% RH, sea level. The reference
 * atmosphere many published G1 BCs were historically normalized to.
 */
export const ARMY_STANDARD_METRO: AtmosphereInput = {
  temperatureK: ISA_SEA_LEVEL_TEMPERATURE_K,
  pressurePa: 750 * PA_PER_MMHG,
  pressureType: 'station',
  altitudeM: 0,
  relativeHumidity: 0.78,
};

/** Convert sea-level-corrected (barometric) pressure to station pressure using the ISA profile. */
export function stationPressureFromBaro(baroPa: number, altitudeM: number): number {
  return (
    baroPa *
    Math.pow(
      1 - (ISA_LAPSE_RATE_K_PER_M * altitudeM) / ISA_SEA_LEVEL_TEMPERATURE_K,
      BAROMETRIC_EXPONENT,
    )
  );
}

export function baroPressureFromStation(stationPa: number, altitudeM: number): number {
  return stationPa / stationPressureFromBaro(1, altitudeM);
}

/** Saturation vapor pressure over water, Pa — Arden Buck (1996). Valid ≈ −80…+50 °C. */
export function saturationVaporPressure(temperatureK: number): number {
  const c = temperatureK - 273.15;
  return 611.21 * Math.exp((18.678 - c / 234.5) * (c / (257.14 + c)));
}

/** Humid air density from dry-air and water-vapor partial pressures, kg/m³. */
export function airDensity(
  temperatureK: number,
  stationPressurePa: number,
  relativeHumidity: number,
): number {
  const vapor = relativeHumidity * saturationVaporPressure(temperatureK);
  const dry = stationPressurePa - vapor;
  return dry / (R_DRY_AIR * temperatureK) + vapor / (R_WATER_VAPOR * temperatureK);
}

/** Speed of sound in dry air, m/s. */
export function speedOfSound(temperatureK: number): number {
  return Math.sqrt(GAMMA_AIR * R_DRY_AIR * temperatureK);
}

/** Altitude in the ISA troposphere that has the given air density, m. */
export function densityAltitude(densityKgM3: number): number {
  return (
    (ISA_SEA_LEVEL_TEMPERATURE_K / ISA_LAPSE_RATE_K_PER_M) *
    (1 - Math.pow(densityKgM3 / ISA_SEA_LEVEL_DENSITY, 1 / (BAROMETRIC_EXPONENT - 1)))
  );
}

export function computeAtmosphere(input: AtmosphereInput): Atmosphere {
  const stationPressurePa =
    input.pressureType === 'station'
      ? input.pressurePa
      : stationPressureFromBaro(input.pressurePa, input.altitudeM);
  const densityKgM3 = airDensity(input.temperatureK, stationPressurePa, input.relativeHumidity);
  return {
    temperatureK: input.temperatureK,
    stationPressurePa,
    relativeHumidity: input.relativeHumidity,
    altitudeM: input.altitudeM,
    vaporPressurePa: input.relativeHumidity * saturationVaporPressure(input.temperatureK),
    densityKgM3,
    speedOfSoundMps: speedOfSound(input.temperatureK),
    densityAltitudeM: densityAltitude(densityKgM3),
  };
}

/** Station pressure in inHg — the unit the Miller stability correction expects. */
export const stationPressureInHg = (atmosphere: Atmosphere): number =>
  atmosphere.stationPressurePa / PA_PER_INHG;
