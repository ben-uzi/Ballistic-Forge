import { EARTH_ROTATION_RAD_PER_S } from './constants';
import { cross, scale, vec, type Vec3 } from './vec';

export interface CoriolisInput {
  /** Positive north. */
  readonly latitudeRad: number;
  /** Azimuth of fire, clockwise from true north. */
  readonly azimuthRad: number;
}

/**
 * Earth's rotation vector in the level ground frame (x downrange horizontal, y up, z right).
 * In local north/up/east coordinates Ω = Ω·(cos φ, sin φ, 0).
 */
export function earthRotationVector({ latitudeRad, azimuthRad }: CoriolisInput): Vec3 {
  const horizontal = EARTH_ROTATION_RAD_PER_S * Math.cos(latitudeRad);
  return vec(
    horizontal * Math.cos(azimuthRad),
    EARTH_ROTATION_RAD_PER_S * Math.sin(latitudeRad),
    -horizontal * Math.sin(azimuthRad),
  );
}

/** Coriolis acceleration −2 Ω × v. */
export function coriolisAcceleration(omega: Vec3, velocity: Vec3): Vec3 {
  return scale(cross(omega, velocity), -2);
}
