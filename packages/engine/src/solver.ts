import { computeAtmosphere, type Atmosphere, type AtmosphereInput } from './atmosphere';
import { STANDARD_GRAVITY } from './constants';
import { earthRotationVector, type CoriolisInput } from './coriolis';
import type { DragModel } from './dragTables';
import {
  integrate,
  muzzleState,
  type FlightEnvironment,
  type FlightState,
  type IntegrationLimits,
  type Termination,
} from './integrator';
import {
  litzAerodynamicJumpRad,
  litzSpinDriftM,
  millerStabilityFactor,
  type TwistDirection,
} from './spinDrift';
import { assertValidSolveInput } from './validation';
import { ZERO_VEC, norm, sub, toLineOfSightFrame, vec } from './vec';
import { windComponents, windVector, type Wind } from './wind';
import { solveZeroAngle } from './zero';

export const DEFAULT_TIME_STEP_S = 0.0005;
export const DEFAULT_VELOCITY_FLOOR_MPS = 50;
export const DEFAULT_MAX_TIME_S = 15;

/** Mach at or below which a row is flagged transonic. */
export const TRANSONIC_MACH = 1.2;
/** Gyroscopic stability below which Litz recommends caution. */
export const MARGINAL_STABILITY = 1.4;

export interface Bullet {
  readonly massKg: number;
  readonly diameterM: number;
  /** Needed for spin drift / stability. Omit when unknown. */
  readonly lengthM?: number;
  readonly drag: DragModel;
}

export interface Rifle {
  /** Bore centerline to scope centerline. */
  readonly sightHeightM: number;
  /** Barrel length per full turn. Omit when unknown. */
  readonly twistM?: number;
  /** Defaults to right. */
  readonly twistDirection?: TwistDirection;
}

export interface ZeroSpec {
  readonly rangeM: number;
  /** Point of impact relative to point of aim at the zero range. Positive = high. */
  readonly offsetM?: number;
  /** Atmosphere at the time of zeroing. Defaults to the current atmosphere. */
  readonly atmosphere?: AtmosphereInput;
  /** Muzzle velocity when zeroed (e.g. unsuppressed). Defaults to the current muzzle velocity. */
  readonly muzzleVelocityMps?: number;
}

export interface AngularOffset {
  /** Positive = impact moves up. */
  readonly verticalRad: number;
  /** Positive = impact moves right. */
  readonly horizontalRad: number;
}

export interface SolveOptions {
  readonly dtS?: number;
  readonly velocityFloorMps?: number;
  readonly maxTimeS?: number;
  /** Default true; silently unavailable (with a warning) when bullet length or twist is unknown. */
  readonly spinDrift?: boolean;
  /** Litz aerodynamic jump approximation. Default false. */
  readonly aerodynamicJump?: boolean;
  /** Extra point-of-impact shift, e.g. a suppressor POI shift. */
  readonly poiOffset?: AngularOffset;
}

export interface SolveInput {
  readonly bullet: Bullet;
  readonly rifle: Rifle;
  readonly zero: ZeroSpec;
  readonly muzzleVelocityMps: number;
  readonly atmosphere: AtmosphereInput;
  readonly wind?: Wind;
  /** Line-of-sight angle, positive uphill. */
  readonly inclineRad?: number;
  /** Omit to ignore Coriolis. */
  readonly coriolis?: CoriolisInput;
  /** Line-of-sight distances to report, metres. */
  readonly ranges: readonly number[];
  readonly options?: SolveOptions;
}

export type FlightRegime = 'supersonic' | 'transonic' | 'subsonic';

export interface TrajectoryRow {
  /** Line-of-sight distance. */
  readonly rangeM: number;
  readonly timeS: number;
  /** Trajectory height relative to the line of sight, positive above (negative = drop). */
  readonly pathM: number;
  /** Lateral impact relative to point of aim, positive right. Includes spin drift. */
  readonly windageM: number;
  /** Correction to dial or hold, positive = up. */
  readonly elevationRad: number;
  /** Correction to dial or hold, positive = right. */
  readonly windageRad: number;
  readonly velocityMps: number;
  /** Airspeed / speed of sound. */
  readonly mach: number;
  readonly regime: FlightRegime;
  readonly energyJ: number;
  /** Lateral spin drift component (included in windageM), positive right. */
  readonly spinDriftM: number;
  /** Coriolis components (included in pathM / windageM). Zero when Coriolis is off. */
  readonly coriolisVerticalM: number;
  readonly coriolisHorizontalM: number;
}

export type SolveWarningCode =
  | 'spin-drift-unavailable'
  | 'aerodynamic-jump-unavailable'
  | 'unstable'
  | 'marginally-stable'
  | 'terminated';

export interface SolveWarning {
  readonly code: SolveWarningCode;
  readonly message: string;
}

export interface Solution {
  readonly rows: readonly TrajectoryRow[];
  /** Bore angle above the line of sight. */
  readonly zeroAngleRad: number;
  readonly atmosphere: Atmosphere;
  readonly zeroAtmosphere: Atmosphere;
  /** Miller Sg, or null when bullet length or twist is unknown. */
  readonly stabilityFactor: number | null;
  readonly warnings: readonly SolveWarning[];
  readonly termination: Termination | null;
}

export function flightRegime(mach: number): FlightRegime {
  if (mach <= 1) return 'subsonic';
  if (mach <= TRANSONIC_MACH) return 'transonic';
  return 'supersonic';
}

function stabilityFor(input: SolveInput, atmosphere: Atmosphere): number | null {
  const { lengthM } = input.bullet;
  const { twistM } = input.rifle;
  if (lengthM === undefined || twistM === undefined) return null;
  return millerStabilityFactor({
    massKg: input.bullet.massKg,
    diameterM: input.bullet.diameterM,
    lengthM,
    twistM,
    muzzleVelocityMps: input.muzzleVelocityMps,
    temperatureK: atmosphere.temperatureK,
    stationPressurePa: atmosphere.stationPressurePa,
  });
}

function missingStabilityInputs(input: SolveInput): string {
  const missing = [
    input.bullet.lengthM === undefined ? 'bullet length' : null,
    input.rifle.twistM === undefined ? 'twist rate' : null,
  ].filter((x) => x !== null);
  return missing.join(' and ');
}

/** Solve a full trajectory: zero, then fly under current conditions and report each range. */
export function solve(input: SolveInput): Solution {
  assertValidSolveInput(input);
  const options = input.options ?? {};
  const limits: IntegrationLimits = {
    dtS: options.dtS ?? DEFAULT_TIME_STEP_S,
    velocityFloorMps: options.velocityFloorMps ?? DEFAULT_VELOCITY_FLOOR_MPS,
    maxTimeS: options.maxTimeS ?? DEFAULT_MAX_TIME_S,
  };

  const atmosphere = computeAtmosphere(input.atmosphere);
  const zeroAtmosphere = input.zero.atmosphere
    ? computeAtmosphere(input.zero.atmosphere)
    : atmosphere;
  const zeroAngleRad = solveZeroAngle({
    drag: input.bullet.drag,
    sightHeightM: input.rifle.sightHeightM,
    muzzleVelocityMps: input.zero.muzzleVelocityMps ?? input.muzzleVelocityMps,
    atmosphere: zeroAtmosphere,
    rangeM: input.zero.rangeM,
    offsetM: input.zero.offsetM ?? 0,
    limits,
  });

  const incline = input.inclineRad ?? 0;
  const env: FlightEnvironment = {
    densityKgM3: atmosphere.densityKgM3,
    speedOfSoundMps: atmosphere.speedOfSoundMps,
    gravity: toLineOfSightFrame(vec(0, -STANDARD_GRAVITY, 0), incline),
    wind: input.wind ? toLineOfSightFrame(windVector(input.wind), incline) : ZERO_VEC,
    omega: input.coriolis ? toLineOfSightFrame(earthRotationVector(input.coriolis), incline) : null,
    drag: input.bullet.drag,
  };

  const ranges = [...new Set(input.ranges)].sort((a, b) => a - b);
  const start = muzzleState(input.muzzleVelocityMps, zeroAngleRad, input.rifle.sightHeightM);
  const flight = integrate(env, start, ranges, limits);
  const noCoriolis = env.omega ? integrate({ ...env, omega: null }, start, ranges, limits) : null;

  const warnings: SolveWarning[] = [];
  const stabilityFactor = stabilityFor(input, atmosphere);
  const twistSign = input.rifle.twistDirection === 'left' ? -1 : 1;

  if (stabilityFactor === null) {
    if (options.spinDrift !== false) {
      warnings.push({
        code: 'spin-drift-unavailable',
        message: `Spin drift is off: ${missingStabilityInputs(input)} unknown.`,
      });
    }
    if (options.aerodynamicJump) {
      warnings.push({
        code: 'aerodynamic-jump-unavailable',
        message: `Aerodynamic jump is off: ${missingStabilityInputs(input)} unknown.`,
      });
    }
  } else if (stabilityFactor < 1) {
    warnings.push({
      code: 'unstable',
      message: `Gyroscopic stability Sg = ${stabilityFactor.toFixed(2)} (< 1.0): this bullet is likely unstable in this twist.`,
    });
  } else if (stabilityFactor < MARGINAL_STABILITY) {
    warnings.push({
      code: 'marginally-stable',
      message: `Gyroscopic stability Sg = ${stabilityFactor.toFixed(2)} (< ${MARGINAL_STABILITY}): marginal; expect reduced BC.`,
    });
  }

  const spinDriftOn = options.spinDrift !== false && stabilityFactor !== null;
  const jumpRad =
    options.aerodynamicJump && stabilityFactor !== null && input.wind && input.bullet.lengthM
      ? twistSign *
        litzAerodynamicJumpRad(
          stabilityFactor,
          input.bullet.lengthM / input.bullet.diameterM,
          windComponents(input.wind).crosswindMps,
        )
      : 0;
  const poiVertical = options.poiOffset?.verticalRad ?? 0;
  const poiHorizontal = options.poiOffset?.horizontalRad ?? 0;

  const toRow = (s: FlightState, index: number): TrajectoryRow => {
    const x = s.p.x;
    const reference = noCoriolis?.samples[index];
    const spinDriftM =
      spinDriftOn && stabilityFactor !== null
        ? twistSign * litzSpinDriftM(stabilityFactor, s.t)
        : 0;
    const pathM = s.p.y + (jumpRad + poiVertical) * x;
    const windageM = s.p.z + spinDriftM + poiHorizontal * x;
    const velocityMps = norm(s.v);
    const mach = norm(sub(s.v, env.wind)) / atmosphere.speedOfSoundMps;
    return {
      rangeM: x,
      timeS: s.t,
      pathM,
      windageM,
      elevationRad: x > 0 ? -Math.atan2(pathM, x) : 0,
      windageRad: x > 0 ? -Math.atan2(windageM, x) : 0,
      velocityMps,
      mach,
      regime: flightRegime(mach),
      energyJ: 0.5 * input.bullet.massKg * velocityMps * velocityMps,
      spinDriftM,
      coriolisVerticalM: reference ? s.p.y - reference.p.y : 0,
      coriolisHorizontalM: reference ? s.p.z - reference.p.z : 0,
    };
  };

  if (flight.termination) {
    const reasons = {
      'velocity-floor': `velocity fell below ${limits.velocityFloorMps} m/s`,
      'time-cap': `time of flight exceeded ${limits.maxTimeS} s`,
      'not-advancing': 'the bullet stopped moving downrange',
    } as const;
    warnings.push({
      code: 'terminated',
      message: `Trajectory ended at ${flight.termination.rangeM.toFixed(0)} m: ${reasons[flight.termination.reason]}.`,
    });
  }

  return {
    rows: flight.samples.map(toRow),
    zeroAngleRad,
    atmosphere,
    zeroAtmosphere,
    stabilityFactor,
    warnings,
    termination: flight.termination,
  };
}

/**
 * The rifleman's (cosine) rule, for comparison with true incline integration: use the level-fire
 * correction for the horizontal distance R·cos θ. Rows are reported at the requested slant ranges.
 */
export function solveRiflemansRule(input: SolveInput): Solution {
  const cos = Math.cos(input.inclineRad ?? 0);
  const level = solve({
    ...input,
    inclineRad: 0,
    ranges: input.ranges.map((r) => r * cos),
  });
  return {
    ...level,
    rows: level.rows.map((row) => {
      const slant = row.rangeM / cos;
      return {
        ...row,
        rangeM: slant,
        pathM: -Math.tan(row.elevationRad) * slant,
        windageM: -Math.tan(row.windageRad) * slant,
      };
    }),
  };
}
