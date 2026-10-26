import type { DragModel } from './dragTables';
import { vec, type Vec3 } from './vec';

/** Everything the equations of motion need, already expressed in the line-of-sight frame. */
export interface FlightEnvironment {
  readonly densityKgM3: number;
  readonly speedOfSoundMps: number;
  readonly gravity: Vec3;
  readonly wind: Vec3;
  /** Earth rotation vector, or null to ignore Coriolis. */
  readonly omega: Vec3 | null;
  readonly drag: DragModel;
}

export interface FlightState {
  readonly t: number;
  readonly p: Vec3;
  readonly v: Vec3;
}

export interface IntegrationLimits {
  readonly dtS: number;
  readonly velocityFloorMps: number;
  readonly maxTimeS: number;
}

export type TerminationReason = 'velocity-floor' | 'time-cap' | 'not-advancing';

export interface Termination {
  readonly reason: TerminationReason;
  readonly rangeM: number;
  readonly timeS: number;
}

export interface IntegrationResult {
  /** One state per reached target, at exactly x = target. */
  readonly samples: readonly FlightState[];
  readonly termination: Termination | null;
}

const PI_OVER_8 = Math.PI / 8;

/** Scratch output for `accelerationInto`; avoids allocating in the hot loop. */
interface MutableVec {
  x: number;
  y: number;
  z: number;
}

/** a = −(π/8)·ρ·|v_air|·(Cd/BC)·v_air + g − 2Ω×v, written into `out`. */
function accelerationInto(
  env: FlightEnvironment,
  vx: number,
  vy: number,
  vz: number,
  out: MutableVec,
): void {
  const ax = vx - env.wind.x;
  const ay = vy - env.wind.y;
  const az = vz - env.wind.z;
  const airspeed = Math.sqrt(ax * ax + ay * ay + az * az);
  const k =
    PI_OVER_8 *
    env.densityKgM3 *
    airspeed *
    env.drag.coefficient(airspeed / env.speedOfSoundMps, airspeed);
  let rx = env.gravity.x - k * ax;
  let ry = env.gravity.y - k * ay;
  let rz = env.gravity.z - k * az;
  const o = env.omega;
  if (o) {
    rx -= 2 * (o.y * vz - o.z * vy);
    ry -= 2 * (o.z * vx - o.x * vz);
    rz -= 2 * (o.x * vy - o.y * vx);
  }
  out.x = rx;
  out.y = ry;
  out.z = rz;
}

/** One classical RK4 step. Acceleration depends only on velocity (constant atmosphere). */
export function rk4Step(env: FlightEnvironment, s: FlightState, dt: number): FlightState {
  const a: MutableVec = { x: 0, y: 0, z: 0 };
  const half = dt / 2;
  const { x: vx, y: vy, z: vz } = s.v;

  accelerationInto(env, vx, vy, vz, a);
  const { x: a1x, y: a1y, z: a1z } = a;
  const v2x = vx + a1x * half,
    v2y = vy + a1y * half,
    v2z = vz + a1z * half;

  accelerationInto(env, v2x, v2y, v2z, a);
  const { x: a2x, y: a2y, z: a2z } = a;
  const v3x = vx + a2x * half,
    v3y = vy + a2y * half,
    v3z = vz + a2z * half;

  accelerationInto(env, v3x, v3y, v3z, a);
  const { x: a3x, y: a3y, z: a3z } = a;
  const v4x = vx + a3x * dt,
    v4y = vy + a3y * dt,
    v4z = vz + a3z * dt;

  accelerationInto(env, v4x, v4y, v4z, a);
  const w = dt / 6;
  return {
    t: s.t + dt,
    p: vec(
      s.p.x + w * (vx + 2 * (v2x + v3x) + v4x),
      s.p.y + w * (vy + 2 * (v2y + v3y) + v4y),
      s.p.z + w * (vz + 2 * (v2z + v3z) + v4z),
    ),
    v: vec(
      vx + w * (a1x + 2 * (a2x + a3x) + a.x),
      vy + w * (a1y + 2 * (a2y + a3y) + a.y),
      vz + w * (a1z + 2 * (a2z + a3z) + a.z),
    ),
  };
}

export function muzzleState(
  muzzleVelocityMps: number,
  boreAngleRad: number,
  sightHeightM: number,
): FlightState {
  return {
    t: 0,
    p: vec(0, -sightHeightM, 0),
    v: vec(
      muzzleVelocityMps * Math.cos(boreAngleRad),
      muzzleVelocityMps * Math.sin(boreAngleRad),
      0,
    ),
  };
}

/**
 * State at x = target between two RK4 steps, by cubic Hermite interpolation in time (uses position
 * and velocity at both ends; exact for a parabola). Velocity is interpolated linearly.
 */
function sampleBetween(a: FlightState, b: FlightState, target: number): FlightState {
  const h = b.t - a.t;
  const hermite = (p0: number, v0: number, p1: number, v1: number, s: number): number => {
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * p0 +
      (s3 - 2 * s2 + s) * h * v0 +
      (-2 * s3 + 3 * s2) * p1 +
      (s3 - s2) * h * v1
    );
  };
  const hermiteRate = (p0: number, v0: number, p1: number, v1: number, s: number): number => {
    const s2 = s * s;
    return (
      ((6 * s2 - 6 * s) * p0 +
        (3 * s2 - 4 * s + 1) * h * v0 +
        (-6 * s2 + 6 * s) * p1 +
        (3 * s2 - 2 * s) * h * v1) /
      h
    );
  };

  let s = (target - a.p.x) / (b.p.x - a.p.x);
  for (let i = 0; i < 3; i++) {
    const x = hermite(a.p.x, a.v.x, b.p.x, b.v.x, s);
    s -= (x - target) / (h * hermiteRate(a.p.x, a.v.x, b.p.x, b.v.x, s));
  }
  const lerp = (u: number, w: number) => u + (w - u) * s;
  return {
    t: a.t + s * h,
    p: vec(target, hermite(a.p.y, a.v.y, b.p.y, b.v.y, s), hermite(a.p.z, a.v.z, b.p.z, b.v.z, s)),
    v: vec(lerp(a.v.x, b.v.x), lerp(a.v.y, b.v.y), lerp(a.v.z, b.v.z)),
  };
}

const speedOf = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

/**
 * Integrate until every target downrange distance (ascending, metres along the LOS) is reached or
 * a stop condition triggers.
 */
export function integrate(
  env: FlightEnvironment,
  initial: FlightState,
  targets: readonly number[],
  limits: IntegrationLimits,
): IntegrationResult {
  const samples: FlightState[] = [];
  let i = 0;
  let s = initial;

  while (i < targets.length && (targets[i] ?? Infinity) <= s.p.x) {
    samples.push(s);
    i++;
  }

  while (i < targets.length) {
    let reason: TerminationReason | null = null;
    if (speedOf(s.v) < limits.velocityFloorMps) reason = 'velocity-floor';
    else if (s.t >= limits.maxTimeS) reason = 'time-cap';

    const next = reason ? s : rk4Step(env, s, limits.dtS);
    if (!reason && next.p.x <= s.p.x) reason = 'not-advancing';
    if (reason) {
      return { samples, termination: { reason, rangeM: s.p.x, timeS: s.t } };
    }

    let target = targets[i] ?? Infinity;
    while (target <= next.p.x) {
      samples.push(sampleBetween(s, next, target));
      i++;
      target = targets[i] ?? Infinity;
    }
    s = next;
  }

  return { samples, termination: null };
}
