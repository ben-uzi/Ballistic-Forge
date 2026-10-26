'use client';

import { convertAngle, stationPressureInHg, type TerminationReason } from '@bf/engine';
import { AlertTriangle, Info } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  UNIT_LABEL,
  fmtDensityAltitude,
  fmtRange,
  fmtStability,
  fmtVelocity,
} from '@/lib/calc/format';
import type { CalcResult } from '@/lib/calc/solve';
import type { FormUnits } from '@/lib/calc/types';

/**
 * What the solver actually did: the conditions it derived, the zero angle it
 * found, stability, and anything it wants to warn about. Shown above the table
 * so a wrong pressure type or an unstable bullet is caught before the numbers
 * are trusted.
 */
export function SolutionSummary({
  result,
  units,
}: {
  readonly result: CalcResult;
  readonly units: FormUnits;
}): ReactElement {
  const { atmosphere } = result;
  const last = result.rows.at(-1);
  const supersonicTo = [...result.rows].reverse().find((row) => row.regime === 'supersonic');

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 sm:grid-cols-4">
        <Stat
          label="Density altitude"
          value={fmtDensityAltitude(atmosphere.densityAltitudeM, units.altitude)}
        />
        <Stat
          label="Station pressure"
          value={`${stationPressureInHg(atmosphere).toFixed(2)} inHg`}
        />
        <Stat
          label="Speed of sound"
          value={`${fmtVelocity(atmosphere.speedOfSoundMps, units.velocity)} ${UNIT_LABEL[units.velocity]}`}
        />
        <Stat
          label="Stability (Sg)"
          value={fmtStability(result.stabilityFactor)}
          tone={
            result.stabilityFactor === null
              ? 'neutral'
              : result.stabilityFactor < 1.4
                ? 'warn'
                : 'pass'
          }
        />
        <Stat
          label="Zero angle"
          value={`${convertAngle(result.zeroAngleRad, 'rad', units.angular).toFixed(2)} ${UNIT_LABEL[units.angular]}`}
        />
        <Stat
          label="Supersonic to"
          value={
            supersonicTo === undefined
              ? '—'
              : `${fmtRange(supersonicTo.rangeM, units.range)} ${UNIT_LABEL[units.range]}`
          }
        />
        <Stat
          label="Last row"
          value={
            last === undefined
              ? '—'
              : `${fmtRange(last.rangeM, units.range)} ${UNIT_LABEL[units.range]}`
          }
        />
        <Stat label="Solve time" value={`${result.elapsedMs.toFixed(1)} ms`} />
      </dl>

      {result.truncated ? (
        <Notice tone="warn">
          That range request produced more rows than the table shows. Increase the step to see the
          whole distance.
        </Notice>
      ) : null}

      {result.termination !== null ? (
        <Notice tone="warn">
          The solve stopped early: {TERMINATION_REASON[result.termination.reason]}. Rows beyond that
          point are not shown.
        </Notice>
      ) : null}

      {result.warnings.map((warning) => (
        <Notice key={warning.code} tone={warning.code === 'unstable' ? 'fail' : 'warn'}>
          {warning.message}
        </Notice>
      ))}
    </div>
  );
}

const TERMINATION_REASON: Readonly<Record<TerminationReason, string>> = {
  'velocity-floor': 'the bullet slowed below the velocity floor',
  'time-cap': 'the flight exceeded the time cap',
  'not-advancing': 'the trajectory stopped advancing downrange',
};

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'neutral' | 'pass' | 'warn';
}): ReactElement {
  return (
    <div className="bg-gunmetal-850 px-3 py-2">
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-700">{label}</dt>
      <dd className="num mt-0.5 flex items-center gap-1.5 text-sm text-ink-100">
        {value}
        {tone === 'warn' ? (
          <Badge tone="warn" title="Below 1.4 the bullet is only marginally stable.">
            low
          </Badge>
        ) : null}
      </dd>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  readonly tone: 'warn' | 'fail' | 'info';
  readonly children: ReactNode;
}): ReactElement {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  const classes =
    tone === 'fail'
      ? 'border-fail-500/40 bg-fail-500/10 text-fail-500'
      : tone === 'warn'
        ? 'border-warn-500/40 bg-warn-500/10 text-warn-500'
        : 'border-gunmetal-700 bg-gunmetal-850 text-ink-300';

  return (
    <p className={`flex items-start gap-2 rounded-card border px-3 py-2 text-xs ${classes}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
