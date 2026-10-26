export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const ZERO_VEC: Vec3 = vec(0, 0, 0);

export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);

export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);

export const norm = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/**
 * Rotate a vector from the level ground frame (x downrange horizontal, y up, z right) into the
 * line-of-sight frame (x along the LOS, which is pitched up by `inclineRad`; z unchanged).
 */
export function toLineOfSightFrame(v: Vec3, inclineRad: number): Vec3 {
  const c = Math.cos(inclineRad);
  const s = Math.sin(inclineRad);
  return vec(v.x * c + v.y * s, -v.x * s + v.y * c, v.z);
}
