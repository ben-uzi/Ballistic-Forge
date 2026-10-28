import {
  applySuppressor,
  convertLength,
  convertVelocity,
  poiShiftToAngular,
  type SolveInput,
  type SuppressorAdjustment,
} from '@bf/engine';
import { canDisplayAggregate, type AppFlags } from '@/lib/flags';
import type { StoredSuppressorSetup } from '@/lib/store/types';

/**
 * Where a suppressor adjustment is allowed to come from.
 *
 * The resolution order is fixed by the brief and is the whole point of the
 * module: **your own measurement, then field data if there is enough of it,
 * then nothing.** There is no fourth branch that invents a plausible number,
 * because a made-up velocity delta is indistinguishable from a real one on
 * screen and ruins the solution silently.
 */
export type DeltaSource = 'user' | 'field' | 'none';

export interface ResolvedDelta {
  readonly source: DeltaSource;
  readonly mvDeltaFps: number | null;
  readonly poiVerticalIn: number | null;
  readonly poiHorizontalIn: number | null;
  readonly poiDistanceYd: number | null;
  /** Sessions behind a field figure. Null for your own data. */
  readonly sampleSize: number | null;
  /** One line explaining where the number came from, or why there isn't one. */
  readonly explanation: string;
}

/** The shape a `field_aggregates` row will arrive in (Phase 6). */
export interface FieldDelta {
  readonly mvDeltaFps: number;
  readonly poiVerticalIn: number | null;
  readonly poiHorizontalIn: number | null;
  readonly sessions: number;
  readonly users: number;
}

const NO_DELTA: ResolvedDelta = {
  source: 'none',
  mvDeltaFps: null,
  poiVerticalIn: null,
  poiHorizontalIn: null,
  poiDistanceYd: null,
  sampleSize: null,
  explanation:
    'No velocity delta recorded for this suppressor on this rifle. Chronograph it suppressed and unsuppressed in the same session, and the solver will use your number.',
};

export function resolveSuppressorDelta(
  setup: StoredSuppressorSetup | null,
  field: FieldDelta | null,
  flags: AppFlags,
): ResolvedDelta {
  if (setup?.mvDeltaFps !== undefined) {
    return {
      source: 'user',
      mvDeltaFps: setup.mvDeltaFps,
      poiVerticalIn: setup.poiVerticalIn ?? null,
      poiHorizontalIn: setup.poiHorizontalIn ?? null,
      poiDistanceYd: setup.measuredAtYd ?? null,
      sampleSize: null,
      explanation:
        setup.measuredAt === undefined
          ? 'Your own measurement for this rifle.'
          : `Your own measurement for this rifle, taken ${setup.measuredAt}.`,
    };
  }

  if (field !== null && canDisplayAggregate(flags, field.sessions, field.users)) {
    return {
      source: 'field',
      mvDeltaFps: field.mvDeltaFps,
      poiVerticalIn: field.poiVerticalIn,
      poiHorizontalIn: field.poiHorizontalIn,
      poiDistanceYd: null,
      sampleSize: field.sessions,
      explanation: `Field data from ${String(field.sessions)} sessions across ${String(field.users)} shooters. Your rifle will differ — measure it.`,
    };
  }

  return NO_DELTA;
}

/**
 * Convert a resolved delta into the engine's adjustment.
 *
 * Returns null when there is nothing measured, so the caller solves the
 * unsuppressed trajectory rather than a subtly wrong suppressed one.
 */
export function toAdjustment(resolved: ResolvedDelta): SuppressorAdjustment | null {
  if (resolved.mvDeltaFps === null || resolved.source === 'none') return null;

  const base: SuppressorAdjustment = {
    source: resolved.source === 'user' ? 'user' : 'field',
    mvDeltaMps: convertVelocity(resolved.mvDeltaFps, 'fps', 'mps'),
    ...(resolved.sampleSize === null ? {} : { sampleSize: resolved.sampleSize }),
  };

  // A point-of-impact shift is only meaningful with the distance it was
  // measured at; without one it cannot be turned into an angle.
  const { poiVerticalIn, poiHorizontalIn, poiDistanceYd } = resolved;
  if (poiDistanceYd === null || poiDistanceYd <= 0) return base;
  if (poiVerticalIn === null && poiHorizontalIn === null) return base;

  return {
    ...base,
    poiShift: poiShiftToAngular(
      convertLength(poiVerticalIn ?? 0, 'in', 'm'),
      convertLength(poiHorizontalIn ?? 0, 'in', 'm'),
      convertLength(poiDistanceYd, 'yd', 'm'),
    ),
  };
}

/**
 * Apply a suppressor to a solve input.
 *
 * `attach` is the usual case: zeroed without the can, shooting with it. The
 * zero angle stays the one established in the zero configuration, which is what
 * the engine's `applySuppressor` enforces.
 */
export function withSuppressor(
  input: SolveInput,
  resolved: ResolvedDelta,
  transition: 'attach' | 'detach' = 'attach',
): SolveInput {
  return applySuppressor(input, toAdjustment(resolved), transition);
}
