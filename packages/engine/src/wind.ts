import { vec, type Vec3 } from './vec';

/**
 * Constant wind. `fromRad` is the direction the wind blows FROM, measured clockwise from the
 * target: 0 = 12 o'clock (headwind), π/2 = 3 o'clock (from the right), π = tailwind.
 */
export interface Wind {
  readonly speedMps: number;
  readonly fromRad: number;
}

/** Clock position (12, 3, 4.5 …) → `fromRad`. */
export function clockToRad(clock: number): number {
  return ((clock % 12) / 12) * 2 * Math.PI;
}

export interface WindComponents {
  /** Positive = headwind, negative = tailwind. */
  readonly headwindMps: number;
  /** Positive = from the right (pushes the bullet left), negative = from the left. */
  readonly crosswindMps: number;
}

export function windComponents(wind: Wind): WindComponents {
  return {
    headwindMps: wind.speedMps * Math.cos(wind.fromRad),
    crosswindMps: wind.speedMps * Math.sin(wind.fromRad),
  };
}

/** Air velocity in the level ground frame (x downrange, y up, z right). */
export function windVector(wind: Wind): Vec3 {
  const { headwindMps, crosswindMps } = windComponents(wind);
  return vec(-headwindMps, 0, -crosswindMps);
}
