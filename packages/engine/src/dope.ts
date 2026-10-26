import { solve, type FlightRegime, type Solution, type SolveInput } from './solver';
import { convertAngle } from './units';

export type AngularUnit = 'mil' | 'moa' | 'iphy';

export interface ClickValue {
  readonly value: number;
  readonly unit: AngularUnit;
}

export const CLICK_VALUES = {
  mil_0_1: { value: 0.1, unit: 'mil' },
  moa_0_25: { value: 0.25, unit: 'moa' },
  moa_0_125: { value: 0.125, unit: 'moa' },
} as const satisfies Record<string, ClickValue>;

/** `down` truncates toward zero (never dials more than the solution). */
export type Rounding = 'nearest' | 'down';

/** Evenly spaced ranges from `startM` to `endM` inclusive. */
export function rangeSteps(startM: number, endM: number, stepM: number): number[] {
  if (!(stepM > 0)) throw new RangeError('Range step must be positive');
  if (endM < startM) return [];
  const count = Math.floor((endM - startM) / stepM + 1e-9) + 1;
  return Array.from({ length: count }, (_, i) => startM + i * stepM);
}

export function toClicks(angleRad: number, click: ClickValue, rounding: Rounding): number {
  const raw = Math.abs(convertAngle(angleRad, 'rad', click.unit) / click.value);
  const clicks = rounding === 'nearest' ? Math.round(raw) : Math.floor(raw + 1e-9);
  return clicks === 0 ? 0 : Math.sign(angleRad) * clicks;
}

export interface Correction {
  /** Exact correction in the display unit. */
  readonly value: number;
  /** Whole turret clicks (signed). */
  readonly clicks: number;
  /** What the clicks actually dial, in the display unit. */
  readonly dialed: number;
  readonly direction: 'U' | 'D' | 'L' | 'R' | null;
}

function correction(
  angleRad: number,
  unit: AngularUnit,
  click: ClickValue,
  rounding: Rounding,
  [positive, negative]: readonly ['U', 'D'] | readonly ['R', 'L'],
): Correction {
  const clicks = toClicks(angleRad, click, rounding);
  const dialed = convertAngle(clicks * click.value, click.unit, unit);
  return {
    value: convertAngle(angleRad, 'rad', unit),
    clicks,
    dialed,
    direction: clicks > 0 ? positive : clicks < 0 ? negative : null,
  };
}

/** Elevation correction; positive angle = dial up. */
export const elevationCorrection = (
  angleRad: number,
  unit: AngularUnit,
  click: ClickValue,
  rounding: Rounding,
): Correction => correction(angleRad, unit, click, rounding, ['U', 'D']);

/** Windage correction; positive angle = dial right. */
export const windageCorrection = (
  angleRad: number,
  unit: AngularUnit,
  click: ClickValue,
  rounding: Rounding,
): Correction => correction(angleRad, unit, click, rounding, ['R', 'L']);

export interface DopeOptions {
  readonly unit: AngularUnit;
  readonly elevationClick: ClickValue;
  readonly windageClick: ClickValue;
  readonly rounding: Rounding;
  /** Full-value crosswind speeds to list holds for (e.g. 5 and 10 mph). */
  readonly windSpeedsMps: readonly number[];
}

export interface WindHold {
  readonly speedMps: number;
  /** Hold for a full-value wind from 3 o'clock (mirror it for 9 o'clock). Excludes spin drift. */
  readonly correction: Correction;
}

export interface DopeRow {
  readonly rangeM: number;
  readonly timeS: number;
  readonly velocityMps: number;
  readonly mach: number;
  readonly regime: FlightRegime;
  readonly energyJ: number;
  readonly pathM: number;
  readonly elevation: Correction;
  /** No-wind windage correction: spin drift, Coriolis and any POI offset. */
  readonly drift: Correction;
  readonly windHolds: readonly WindHold[];
}

export interface DopeTable {
  readonly rows: readonly DopeRow[];
  /** The no-wind solution the elevation column comes from. */
  readonly solution: Solution;
}

/** Build a DOPE table: elevation in still air plus per-speed full-value crosswind holds. */
export function buildDope(input: SolveInput, options: DopeOptions): DopeTable {
  const { wind: _ignored, ...still } = input;
  const solution = solve(still);
  const windRuns = options.windSpeedsMps.map((speedMps) => {
    const rows = solve({ ...still, wind: { speedMps, fromRad: Math.PI / 2 } }).rows;
    return { speedMps, byRange: new Map(rows.map((r) => [r.rangeM, r])) };
  });

  const rows = solution.rows.map((row): DopeRow => {
    const windHolds = windRuns.flatMap(({ speedMps, byRange }) => {
      const windy = byRange.get(row.rangeM);
      if (!windy) return [];
      const windOnlyM = windy.windageM - row.windageM;
      const angle = row.rangeM > 0 ? -Math.atan2(windOnlyM, row.rangeM) : 0;
      return [
        {
          speedMps,
          correction: windageCorrection(
            angle,
            options.unit,
            options.windageClick,
            options.rounding,
          ),
        },
      ];
    });
    return {
      rangeM: row.rangeM,
      timeS: row.timeS,
      velocityMps: row.velocityMps,
      mach: row.mach,
      regime: row.regime,
      energyJ: row.energyJ,
      pathM: row.pathM,
      elevation: elevationCorrection(
        row.elevationRad,
        options.unit,
        options.elevationClick,
        options.rounding,
      ),
      drift: windageCorrection(
        row.windageRad,
        options.unit,
        options.windageClick,
        options.rounding,
      ),
      windHolds,
    };
  });

  return { rows, solution };
}
