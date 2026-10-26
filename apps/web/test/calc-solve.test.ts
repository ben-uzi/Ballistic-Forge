import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { byField, hasErrors, unmapped } from '@/lib/calc/issues';
import { issuesFor, runCalc } from '@/lib/calc/solve';
import type { CalcForm } from '@/lib/calc/types';

describe('runCalc', () => {
  it('solves the default form', () => {
    const outcome = runCalc(DEFAULT_FORM);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.rows).toHaveLength(11);
    const [first] = outcome.result.rows;
    expect(first?.rangeM).toBe(0);
    // At the muzzle the bullet sits a sight height below the line of sight.
    expect(first?.pathM).toBeLessThan(0);
  });

  it('crosses the line of sight at the zero range', () => {
    const outcome = runCalc({ ...DEFAULT_FORM, rangeStart: 100, rangeEnd: 100, rangeStep: 100 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.rows[0]?.pathM ?? 1).toBeCloseTo(0, 3);
  });

  it('drops monotonically and slows monotonically downrange', () => {
    const outcome = runCalc(DEFAULT_FORM);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const rows = outcome.result.rows;
    for (let i = 2; i < rows.length; i += 1) {
      expect(rows[i]?.velocityMps ?? 0).toBeLessThan(rows[i - 1]?.velocityMps ?? 0);
      expect(rows[i]?.pathM ?? 0).toBeLessThan(rows[i - 1]?.pathM ?? 0);
    }
  });

  it('mirrors a 9 o’clock wind against a 3 o’clock wind', () => {
    const right = runCalc({
      ...DEFAULT_FORM,
      windSpeed: 10,
      windFromClock: 3,
      spinDriftEnabled: false,
    });
    const left = runCalc({
      ...DEFAULT_FORM,
      windSpeed: 10,
      windFromClock: 9,
      spinDriftEnabled: false,
    });
    expect(right.ok && left.ok).toBe(true);
    if (!right.ok || !left.ok) return;

    const r = right.result.rows.at(-1)?.windageM ?? 0;
    const l = left.result.rows.at(-1)?.windageM ?? 0;
    expect(r).toBeCloseTo(-l, 9);
    expect(Math.abs(r)).toBeGreaterThan(0.1);
  });

  it('reports elevation as an up correction with whole clicks', () => {
    const outcome = runCalc(DEFAULT_FORM);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const last = outcome.result.rows.at(-1);
    expect(last?.elevation.direction).toBe('U');
    expect(last?.elevation.clicks).toBeGreaterThan(0);
    expect(Number.isInteger(last?.elevation.clicks)).toBe(true);
  });

  it('refuses to solve and explains why when an input is impossible', () => {
    const broken: CalcForm = { ...DEFAULT_FORM, muzzleVelocity: 0 };
    const outcome = runCalc(broken);
    expect(outcome.ok).toBe(false);
    expect(hasErrors(outcome.issues)).toBe(true);
  });

  it('flags an empty range request rather than returning an empty table', () => {
    const outcome = runCalc({ ...DEFAULT_FORM, rangeStep: 0 });
    expect(outcome.ok).toBe(false);
    expect(outcome.issues.some((i) => i.code === 'empty-range')).toBe(true);
  });

  it('warns rather than fails when spin drift has nothing to work with', () => {
    const outcome = runCalc({ ...DEFAULT_FORM, bulletLength: null });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.stabilityFactor).toBeNull();
    expect(outcome.result.warnings.some((w) => w.code === 'spin-drift-unavailable')).toBe(true);
  });

  it('marks the request as truncated when the row cap bites', () => {
    const outcome = runCalc({ ...DEFAULT_FORM, rangeEnd: 2000, rangeStep: 1 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.truncated).toBe(true);
  });

  it('stays well inside the interaction budget', () => {
    const outcome = runCalc({ ...DEFAULT_FORM, rangeEnd: 1500, rangeStep: 25 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // BUILD_BRIEF §6.2 budgets 50 ms on a mid phone; desktop headroom is large.
    expect(outcome.result.elapsedMs).toBeLessThan(50);
  });
});

describe('issuesFor', () => {
  it('finds nothing wrong with the default form', () => {
    expect(issuesFor(DEFAULT_FORM).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('puts errors ahead of warnings', () => {
    const issues = issuesFor({ ...DEFAULT_FORM, muzzleVelocity: 0, sightHeight: 25 });
    expect(issues[0]?.severity).toBe('error');
  });

  it('catches a sight height that is obviously a typo', () => {
    const issues = issuesFor({ ...DEFAULT_FORM, sightHeight: 25 });
    expect(issues.some((i) => i.path === 'rifle.sightHeightM')).toBe(true);
  });

  it('catches barometric pressure entered as station pressure', () => {
    const issues = issuesFor({ ...DEFAULT_FORM, pressure: 25, pressureType: 'baro' });
    expect(issues.some((i) => i.code === 'baro-looks-like-station')).toBe(true);
  });

  it('questions an implausible ballistic coefficient', () => {
    const issues = issuesFor({ ...DEFAULT_FORM, bcType: 'G7', bcValue: 1.1 });
    expect(issues.some((i) => i.path === 'bc')).toBe(true);
  });
});

describe('issue routing', () => {
  it('lands engine paths on the matching form field', () => {
    const issues = issuesFor({ ...DEFAULT_FORM, sightHeight: 25 });
    expect(byField(issues).get('sightHeight')?.path).toBe('rifle.sightHeightM');
  });

  it('prefers an error over a warning on the same field', () => {
    const map = byField([
      { path: 'rifle.sightHeightM', code: 'unusual', severity: 'warning', message: 'warn' },
      { path: 'rifle.sightHeightM', code: 'not-positive', severity: 'error', message: 'error' },
    ]);
    expect(map.get('sightHeight')?.severity).toBe('error');
  });

  it('keeps unroutable issues so they can still be shown', () => {
    const orphan = {
      path: 'something.else',
      code: 'x',
      severity: 'error',
      message: 'm',
    } as const;
    expect(unmapped([orphan])).toEqual([orphan]);
    expect(byField([orphan]).size).toBe(0);
  });
});
