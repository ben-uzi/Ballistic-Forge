import {
  convertAngle,
  convertLength,
  convertVelocity,
  trueBallisticCoefficient,
  trueMuzzleVelocity,
  type AngularUnit,
  type TruingResult,
} from '@bf/engine';
import { toSolveInput } from '@/lib/calc/map';
import type { CalcForm } from '@/lib/calc/types';

/**
 * Truing, in the units the form is using.
 *
 * "Proven in the Field": the shooter dialled something at a known distance and
 * the bullet landed centre. That one observation is enough to back out either
 * the muzzle velocity or a BC scale factor. Which one to trust depends on the
 * distance, and the engine says so in its warnings rather than silently
 * returning a confident number.
 */

export type TruingKind = 'muzzle-velocity' | 'bc-scale';

export interface TruingRequest {
  readonly form: CalcForm;
  readonly kind: TruingKind;
  /** Distance of the observation, in the form's range unit. */
  readonly distance: number;
  /** Elevation that centred the group, in the form's angular unit, positive up. */
  readonly observedElevation: number;
}

export interface TruingOutcome {
  readonly result: TruingResult;
  /** Trued muzzle velocity in the form's velocity unit, when that is the kind. */
  readonly muzzleVelocity: number | null;
  /** BC scale factor, when that is the kind. */
  readonly bcScale: number | null;
  /** The new BC the scale factor implies. */
  readonly scaledBc: number | null;
  /** What the untrued profile predicted, in the form's angular unit. */
  readonly predictedElevation: number | null;
}

export function runTruing({
  form,
  kind,
  distance,
  observedElevation,
}: TruingRequest): TruingOutcome {
  const base = toSolveInput(form);
  const input = {
    base,
    distanceM: convertLength(distance, form.units.range, 'm'),
    observedElevationRad: convertAngle(observedElevation, form.units.angular, 'rad'),
  };

  const result =
    kind === 'muzzle-velocity' ? trueMuzzleVelocity(input) : trueBallisticCoefficient(input);

  return {
    result,
    muzzleVelocity:
      result.kind === 'muzzle-velocity'
        ? round(convertVelocity(result.value, 'mps', form.units.velocity), 1)
        : null,
    bcScale: result.kind === 'bc-scale' ? round(result.value, 4) : null,
    scaledBc: result.kind === 'bc-scale' ? round(form.bcValue * result.value, 4) : null,
    predictedElevation:
      result.predictedElevationRad === null
        ? null
        : round(
            convertAngle(result.predictedElevationRad, 'rad', form.units.angular),
            form.units.angular === 'mil' ? 1 : 2,
          ),
  };
}

/** How far off the original profile was, in the form's angular unit. */
export function truingError(outcome: TruingOutcome, unit: AngularUnit): number | null {
  if (outcome.result.predictedElevationRad === null) return null;
  const observed = convertAngle(outcome.result.observedElevationRad, 'rad', unit);
  const predicted = convertAngle(outcome.result.predictedElevationRad, 'rad', unit);
  return round(observed - predicted, unit === 'mil' ? 2 : 3);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
