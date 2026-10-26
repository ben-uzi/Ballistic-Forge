import {
  KG_PER_GRAIN,
  METERS_PER_FOOT,
  METERS_PER_INCH,
  MPS_PER_MPH,
  PA_PER_INHG,
  RAD_PER_MOA,
  convertTemperature,
} from './units';

export type TwistDirection = 'right' | 'left';

export interface StabilityInput {
  readonly massKg: number;
  readonly diameterM: number;
  readonly lengthM: number;
  /** Barrel length per full turn (a 1:8" twist is 8 in). */
  readonly twistM: number;
  readonly muzzleVelocityMps: number;
  readonly temperatureK: number;
  readonly stationPressurePa: number;
}

/**
 * Miller twist rule gyroscopic stability factor Sg, with Miller's velocity correction
 * (v/2800 fps)^(1/3) and atmospheric correction ((T°F + 460)/519) · (29.92/P inHg).
 */
export function millerStabilityFactor(input: StabilityInput): number {
  const massGr = input.massKg / KG_PER_GRAIN;
  const diameterIn = input.diameterM / METERS_PER_INCH;
  const lengthCal = input.lengthM / input.diameterM;
  const twistCal = input.twistM / input.diameterM;

  const base =
    (30 * massGr) /
    (twistCal * twistCal * diameterIn ** 3 * lengthCal * (1 + lengthCal * lengthCal));
  const velocityCorrection = Math.cbrt(input.muzzleVelocityMps / METERS_PER_FOOT / 2800);
  const temperatureF = convertTemperature(input.temperatureK, 'K', 'F');
  const atmosphereCorrection =
    ((temperatureF + 460) / (59 + 460)) * (29.92 / (input.stationPressurePa / PA_PER_INHG));
  return base * velocityCorrection * atmosphereCorrection;
}

/**
 * Litz spin drift approximation: SD(in) = 1.25 · (Sg + 1.2) · TOF^1.83. Returns metres, always
 * positive (drift is toward the twist direction; the caller applies the sign).
 */
export function litzSpinDriftM(stabilityFactor: number, timeOfFlightS: number): number {
  return 1.25 * (stabilityFactor + 1.2) * Math.pow(timeOfFlightS, 1.83) * METERS_PER_INCH;
}

/**
 * Litz aerodynamic jump approximation: (0.01·Sg − 0.0024·L + 0.032) MOA per mph of crosswind,
 * L = bullet length in calibers. Returns vertical angle in rad for a right-hand twist (positive =
 * up for wind from the right); the caller flips the sign for left-hand twist.
 */
export function litzAerodynamicJumpRad(
  stabilityFactor: number,
  lengthCalibers: number,
  crosswindFromRightMps: number,
): number {
  const moaPerMph = 0.01 * stabilityFactor - 0.0024 * lengthCalibers + 0.032;
  return moaPerMph * (crosswindFromRightMps / MPS_PER_MPH) * RAD_PER_MOA;
}
