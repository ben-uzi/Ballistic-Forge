import {
  BallisticsInputError,
  elevationCorrection,
  solve,
  validateSolveInput,
  validateStandardBc,
  windageCorrection,
  type Atmosphere,
  type Correction,
  type FlightRegime,
  type SolveWarning,
  type Termination,
  type ValidationIssue,
} from '@bf/engine';
import { clickValue, rangeListM, toSolveInput } from './map';
import type { CalcForm, CompareLoad } from './types';

export interface CalcRow {
  readonly rangeM: number;
  readonly timeS: number;
  readonly velocityMps: number;
  readonly mach: number;
  readonly regime: FlightRegime;
  readonly energyJ: number;
  /** Height relative to the line of sight; negative is drop. */
  readonly pathM: number;
  readonly windageM: number;
  readonly spinDriftM: number;
  readonly elevation: Correction;
  readonly windage: Correction;
}

export interface CalcResult {
  readonly rows: readonly CalcRow[];
  readonly zeroAngleRad: number;
  readonly atmosphere: Atmosphere;
  readonly zeroAtmosphere: Atmosphere;
  readonly stabilityFactor: number | null;
  readonly warnings: readonly SolveWarning[];
  readonly termination: Termination | null;
  /** The range request hit the row cap. */
  readonly truncated: boolean;
  readonly elapsedMs: number;
}

export type CalcOutcome =
  | { readonly ok: true; readonly result: CalcResult; readonly issues: readonly ValidationIssue[] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Validation issues for the form, errors first. Safe to call on every keystroke. */
export function issuesFor(form: CalcForm, override?: CompareLoad): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  try {
    const input = toSolveInput(form, override);
    issues.push(...validateSolveInput(input));
    issues.push(
      ...validateStandardBc(override?.bcType ?? form.bcType, override?.bcValue ?? form.bcValue),
    );
  } catch (error) {
    issues.push({
      path: 'form',
      code: 'invalid-input',
      severity: 'error',
      message: error instanceof Error ? error.message : 'Those inputs cannot be solved.',
    });
  }
  if (rangeListM(form).rangesM.length === 0) {
    issues.push({
      path: 'rangeStep',
      code: 'empty-range',
      severity: 'error',
      message: 'The range start, end and step do not produce any rows.',
    });
  }
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

/**
 * Solve the form.
 *
 * Runs on the main thread: a full 0–1,500 yd solve measures 5.9 ms on desktop
 * and the integrator's cost is set by the time step, not the number of reported
 * rows, so even three compared loads stay far inside the 50 ms budget
 * (BUILD_BRIEF §6.2). See DECISIONS.md for the worker trade-off.
 */
export function runCalc(form: CalcForm, override?: CompareLoad): CalcOutcome {
  const issues = issuesFor(form, override);
  if (issues.some((i) => i.severity === 'error')) return { ok: false, issues };

  const input = toSolveInput(form, override);
  const elevationClick = clickValue(form.elevationClickKey);
  const windageClick = clickValue(form.windageClickKey);
  const unit = form.units.angular;

  const startedAt = now();
  let solution;
  try {
    solution = solve(input);
  } catch (error) {
    if (error instanceof BallisticsInputError) {
      return { ok: false, issues: error.issues };
    }
    return {
      ok: false,
      issues: [
        {
          path: 'form',
          code: 'solve-failed',
          severity: 'error',
          message: error instanceof Error ? error.message : 'The solver could not run.',
        },
      ],
    };
  }
  const elapsedMs = now() - startedAt;

  const rows = solution.rows.map((row): CalcRow => ({
    rangeM: row.rangeM,
    timeS: row.timeS,
    velocityMps: row.velocityMps,
    mach: row.mach,
    regime: row.regime,
    energyJ: row.energyJ,
    pathM: row.pathM,
    windageM: row.windageM,
    spinDriftM: row.spinDriftM,
    elevation: elevationCorrection(row.elevationRad, unit, elevationClick, form.rounding),
    windage: windageCorrection(row.windageRad, unit, windageClick, form.rounding),
  }));

  return {
    ok: true,
    issues,
    result: {
      rows,
      zeroAngleRad: solution.zeroAngleRad,
      atmosphere: solution.atmosphere,
      zeroAtmosphere: solution.zeroAtmosphere,
      stabilityFactor: solution.stabilityFactor,
      warnings: solution.warnings,
      termination: solution.termination,
      truncated: rangeListM(form).truncated,
      elapsedMs,
    },
  };
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}
