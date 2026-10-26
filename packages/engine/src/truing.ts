import type { AtmosphereInput } from './atmosphere';
import { scaledDragModel } from './dragTables';
import { illinois } from './rootFinding';
import { solve, type SolveInput } from './solver';
import { RAD_PER_MIL } from './units';

/** Muzzle velocity truing searches within ±25% of the chronographed value. */
export const MV_TRUING_BOUNDS = 0.25;
/** BC scale truing searches within this factor range. */
export const BC_TRUING_BOUNDS: readonly [number, number] = [0.6, 1.4];
/** Changes smaller than one 0.1 MIL click are treated as "not meaningful". */
const MEANINGFUL_ELEVATION_RAD = 0.1 * RAD_PER_MIL;
/** BC truing is most informative once the bullet is near the transonic region. */
const BC_TRUING_MAX_MACH = 1.5;
const ELEVATION_TOLERANCE_RAD = 1e-7;

export interface TruingInput {
  /** Current profile: chrono MV, published BC, and the conditions of the observation. */
  readonly base: SolveInput;
  /** Line-of-sight distance of the observed impacts. */
  readonly distanceM: number;
  /** Elevation correction that actually centered impacts at `distanceM`, positive up. */
  readonly observedElevationRad: number;
}

export type TruingWarningCode = 'distance-too-short' | 'still-supersonic' | 'out-of-bounds';

export interface TruingWarning {
  readonly code: TruingWarningCode;
  readonly message: string;
}

export interface TruingResult {
  readonly kind: 'muzzle-velocity' | 'bc-scale';
  readonly converged: boolean;
  /** Trued MV (m/s) or BC scale factor; equals `originalValue` when not converged. */
  readonly value: number;
  readonly originalValue: number;
  readonly iterations: number;
  readonly distanceM: number;
  readonly observedElevationRad: number;
  /** What the untrued profile predicts at `distanceM`, or null if it can't get there. */
  readonly predictedElevationRad: number | null;
  readonly warnings: readonly TruingWarning[];
  /** Conditions of the observation, to store alongside the trued value. */
  readonly atmosphere: AtmosphereInput;
}

interface Prediction {
  readonly elevationRad: number;
  readonly mach: number;
}

function predict(input: SolveInput, distanceM: number): Prediction | null {
  const [row] = solve({ ...input, ranges: [distanceM] }).rows;
  return row ? { elevationRad: row.elevationRad, mach: row.mach } : null;
}

function withMuzzleVelocity(input: SolveInput, mv: number): SolveInput {
  const delta = mv - input.muzzleVelocityMps;
  const zeroMv = input.zero.muzzleVelocityMps;
  return {
    ...input,
    muzzleVelocityMps: mv,
    zero: zeroMv === undefined ? input.zero : { ...input.zero, muzzleVelocityMps: zeroMv + delta },
  };
}

function withBcScale(input: SolveInput, bcScale: number): SolveInput {
  return {
    ...input,
    bullet: { ...input.bullet, drag: scaledDragModel(input.bullet.drag, bcScale) },
  };
}

function runTruing(
  kind: TruingResult['kind'],
  t: TruingInput,
  originalValue: number,
  bounds: readonly [number, number],
  apply: (input: SolveInput, value: number) => SolveInput,
  sensitivitySpan: readonly [number, number],
  warnings: TruingWarning[],
  xTol: number,
): TruingResult {
  const elevation = (value: number) =>
    predict(apply(t.base, value), t.distanceM)?.elevationRad ?? Number.NaN;

  const predicted = predict(t.base, t.distanceM);
  const sensitivity = Math.abs(elevation(sensitivitySpan[0]) - elevation(sensitivitySpan[1])) / 2;
  if (!(sensitivity >= MEANINGFUL_ELEVATION_RAD)) {
    warnings.push({
      code: 'distance-too-short',
      message:
        kind === 'muzzle-velocity'
          ? 'At this distance a 1% velocity change moves impact less than one 0.1 MIL click — true at a longer distance.'
          : 'At this distance a 2.5% BC change moves impact less than one 0.1 MIL click — true at a longer distance.',
    });
  }

  const root = illinois(
    (value) => elevation(value) - t.observedElevationRad,
    bounds[0],
    bounds[1],
    ELEVATION_TOLERANCE_RAD,
    xTol,
  );
  const converged = root?.converged ?? false;
  if (!converged) {
    warnings.push({
      code: 'out-of-bounds',
      message:
        kind === 'muzzle-velocity'
          ? `No muzzle velocity within ±${MV_TRUING_BOUNDS * 100}% of the chrono value matches the observed correction — check the distance, correction units and zero.`
          : `No BC scale within ${bounds[0]}–${bounds[1]}× matches the observed correction — check the inputs or true muzzle velocity first.`,
    });
  }

  return {
    kind,
    converged,
    value: root && converged ? root.x : originalValue,
    originalValue,
    iterations: root?.iterations ?? 0,
    distanceM: t.distanceM,
    observedElevationRad: t.observedElevationRad,
    predictedElevationRad: predicted?.elevationRad ?? null,
    warnings,
    atmosphere: t.base.atmosphere,
  };
}

/** Solve for the muzzle velocity that reproduces an observed elevation correction. */
export function trueMuzzleVelocity(t: TruingInput): TruingResult {
  const mv = t.base.muzzleVelocityMps;
  return runTruing(
    'muzzle-velocity',
    t,
    mv,
    [mv * (1 - MV_TRUING_BOUNDS), mv * (1 + MV_TRUING_BOUNDS)],
    withMuzzleVelocity,
    [mv * 0.99, mv * 1.01],
    [],
    1e-3,
  );
}

/** Solve for the BC scale factor that reproduces an observed long-range elevation correction. */
export function trueBallisticCoefficient(t: TruingInput): TruingResult {
  const warnings: TruingWarning[] = [];
  const predicted = predict(t.base, t.distanceM);
  if (predicted && predicted.mach > BC_TRUING_MAX_MACH) {
    warnings.push({
      code: 'still-supersonic',
      message: `The bullet is still at Mach ${predicted.mach.toFixed(2)} here. BC truing is most reliable near the transonic range; true muzzle velocity at this distance instead.`,
    });
  }
  return runTruing('bc-scale', t, 1, BC_TRUING_BOUNDS, withBcScale, [0.975, 1.025], warnings, 1e-5);
}
