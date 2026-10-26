import type { AngularOffset, SolveInput } from './solver';

/** Where a suppressor adjustment came from. Never a generic made-up delta. */
export type AdjustmentSource = 'user' | 'field';

export interface SuppressorAdjustment {
  readonly source: AdjustmentSource;
  /** Suppressed MV minus unsuppressed MV (usually positive). */
  readonly mvDeltaMps: number;
  /** Suppressed POI minus unsuppressed POI. */
  readonly poiShift?: AngularOffset;
  /** Sessions behind the number (field data). */
  readonly sampleSize?: number;
}

/**
 * `attach`: zeroed without the can, shooting with it. `detach`: zeroed with the can, shooting
 * without it. In both cases the zero angle stays the one established in the zero configuration.
 */
export type SuppressorTransition = 'attach' | 'detach';

/** Convert a measured POI shift at a distance into an angular offset. */
export function poiShiftToAngular(
  verticalM: number,
  horizontalM: number,
  distanceM: number,
): AngularOffset {
  return {
    verticalRad: Math.atan2(verticalM, distanceM),
    horizontalRad: Math.atan2(horizontalM, distanceM),
  };
}

export function applySuppressor(
  input: SolveInput,
  adjustment: SuppressorAdjustment | null,
  transition: SuppressorTransition,
): SolveInput {
  if (!adjustment) return input;
  const sign = transition === 'attach' ? 1 : -1;
  const existing = input.options?.poiOffset;
  const shift = adjustment.poiShift;
  return {
    ...input,
    muzzleVelocityMps: input.muzzleVelocityMps + sign * adjustment.mvDeltaMps,
    zero: {
      ...input.zero,
      muzzleVelocityMps: input.zero.muzzleVelocityMps ?? input.muzzleVelocityMps,
    },
    options: {
      ...input.options,
      poiOffset: {
        verticalRad: (existing?.verticalRad ?? 0) + sign * (shift?.verticalRad ?? 0),
        horizontalRad: (existing?.horizontalRad ?? 0) + sign * (shift?.horizontalRad ?? 0),
      },
    },
  };
}
