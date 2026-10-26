import type { AngularUnit, Rounding } from '@bf/engine';
import type { BcType, TwistDirection } from '@/lib/store/types';

export type ClickKey = 'mil_0_1' | 'moa_0_25' | 'moa_0_125';

export type RangeUnit = 'yd' | 'm';
export type VelocityUnit = 'fps' | 'mps';
export type TemperatureUnit = 'F' | 'C';
export type PressureUnit = 'inHg' | 'hPa';
export type AltitudeUnit = 'ft' | 'm';
/** Sight height, bullet length and diameter, twist, zero offset. */
export type SmallLengthUnit = 'in' | 'mm';
export type MassUnit = 'gr' | 'g';
export type WindSpeedUnit = 'mph' | 'mps' | 'kph';
export type EnergyUnit = 'ftlbf' | 'J';

/**
 * The units the form's numbers are expressed in. Stored alongside the values so
 * what the user typed round-trips exactly — no re-rounding on every render.
 */
export interface FormUnits {
  readonly range: RangeUnit;
  readonly velocity: VelocityUnit;
  readonly temperature: TemperatureUnit;
  readonly pressure: PressureUnit;
  readonly altitude: AltitudeUnit;
  readonly smallLength: SmallLengthUnit;
  readonly mass: MassUnit;
  readonly windSpeed: WindSpeedUnit;
  readonly energy: EnergyUnit;
  readonly angular: AngularUnit;
}

/**
 * The calculator form. Every number is in the matching `units` field, so the
 * screen is the source of truth; `toSolveInput` is the only place that converts
 * to the engine's SI inputs.
 */
export interface CalcForm {
  readonly units: FormUnits;

  // ── Bullet / load ──────────────────────────────────────────────────────────
  readonly bulletName: string;
  readonly diameter: number;
  readonly weight: number;
  readonly bcType: BcType;
  readonly bcValue: number;
  /** Needed for spin drift and stability. Null when unknown. */
  readonly bulletLength: number | null;
  readonly muzzleVelocity: number;
  /** True when the numbers came from library data no human has checked. */
  readonly dataUnverified: boolean;

  // ── Rifle ──────────────────────────────────────────────────────────────────
  readonly sightHeight: number;
  /** Barrel length per full turn. Null when unknown. */
  readonly twist: number | null;
  readonly twistDirection: TwistDirection;
  readonly zeroRange: number;
  /** Measured point of impact at the zero range, positive high. */
  readonly zeroOffset: number;
  readonly elevationClickKey: ClickKey;
  readonly windageClickKey: ClickKey;
  readonly rounding: Rounding;

  // ── Conditions ─────────────────────────────────────────────────────────────
  readonly temperature: number;
  readonly pressure: number;
  /** Station = read at the shooting position. Baro = sea-level corrected. */
  readonly pressureType: 'station' | 'baro';
  readonly altitude: number;
  /** Percent, 0–100. */
  readonly humidity: number;
  readonly windSpeed: number;
  /** Clock position the wind blows FROM: 12 = headwind, 3 = from the right. */
  readonly windFromClock: number;
  readonly inclineDeg: number;

  // ── Zero conditions (optional; defaults to the current conditions) ─────────
  readonly useZeroAtmosphere: boolean;
  readonly zeroTemperature: number;
  readonly zeroAltitude: number;

  // ── Effects ────────────────────────────────────────────────────────────────
  readonly spinDriftEnabled: boolean;
  readonly aerodynamicJumpEnabled: boolean;
  readonly coriolisEnabled: boolean;
  /** Positive north. */
  readonly latitudeDeg: number;
  /** Clockwise from true north. */
  readonly azimuthDeg: number;

  // ── Output ─────────────────────────────────────────────────────────────────
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly rangeStep: number;
  /** Full-value crosswind speeds to list hold columns for, in `units.windSpeed`. */
  readonly windHoldSpeeds: readonly number[];
}

/** One of up to three loads overlaid in compare mode. Only what differs. */
export interface CompareLoad {
  readonly id: string;
  readonly label: string;
  readonly bcType: BcType;
  readonly bcValue: number;
  readonly weight: number;
  readonly diameter: number;
  readonly bulletLength: number | null;
  readonly muzzleVelocity: number;
}

export const MAX_COMPARE_LOADS = 3;
