import type { Atmosphere } from './atmosphere';
import { STANDARD_GRAVITY } from './constants';
import type { DragModel } from './dragTables';
import {
  integrate,
  muzzleState,
  type FlightEnvironment,
  type IntegrationLimits,
} from './integrator';
import { bisect, secant } from './rootFinding';
import { ZERO_VEC, vec } from './vec';

/** Zero solve tolerance on point of impact at the zero range: 1e-6 m (≈ 0.00004 in). */
export const ZERO_TOLERANCE_M = 1e-6;

export interface ZeroProblem {
  readonly drag: DragModel;
  readonly sightHeightM: number;
  readonly muzzleVelocityMps: number;
  /** The atmosphere the rifle was zeroed in (may differ from today's). */
  readonly atmosphere: Atmosphere;
  readonly rangeM: number;
  /** Desired point of impact relative to point of aim at the zero range. Positive = high. */
  readonly offsetM: number;
  readonly limits: IntegrationLimits;
}

export class ZeroUnreachableError extends Error {
  constructor(rangeM: number) {
    super(`The bullet cannot reach the zero range of ${rangeM.toFixed(1)} m with these inputs`);
    this.name = 'ZeroUnreachableError';
  }
}

/**
 * Bore angle above the line of sight (rad) that puts the point of impact at `offsetM` at the zero
 * range. Zeroing is solved level, in still air, without Coriolis.
 */
export function solveZeroAngle(problem: ZeroProblem): number {
  const env: FlightEnvironment = {
    densityKgM3: problem.atmosphere.densityKgM3,
    speedOfSoundMps: problem.atmosphere.speedOfSoundMps,
    gravity: vec(0, -STANDARD_GRAVITY, 0),
    wind: ZERO_VEC,
    omega: null,
    drag: problem.drag,
  };
  const miss = (angle: number): number => {
    const start = muzzleState(problem.muzzleVelocityMps, angle, problem.sightHeightM);
    const [sample] = integrate(env, start, [problem.rangeM], problem.limits).samples;
    return sample ? sample.p.y - problem.offsetM : -Infinity;
  };

  const mv = problem.muzzleVelocityMps;
  const guess =
    (problem.sightHeightM + problem.offsetM) / problem.rangeM +
    (STANDARD_GRAVITY * problem.rangeM) / (2 * mv * mv);
  const fast = secant(miss, guess, guess * 1.01 + 1e-5, ZERO_TOLERANCE_M);
  if (fast.converged) return fast.x;

  const robust = bisect(miss, -0.1, Math.PI / 4, ZERO_TOLERANCE_M);
  if (!robust) throw new ZeroUnreachableError(problem.rangeM);
  return robust.x;
}
