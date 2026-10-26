'use client';

import { convertEnergy, convertLength, convertVelocity } from '@bf/engine';
import { useMemo, type ReactElement } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UNIT_LABEL, dropUnitFor } from '@/lib/calc/format';
import type { CalcRow } from '@/lib/calc/solve';
import type { FormUnits } from '@/lib/calc/types';

/**
 * Series colours.
 *
 * Validated for the dark chart surface (#22223A) with the dataviz six checks:
 * all three sit inside the dark lightness band, clear the chroma floor, hold
 * ΔE ≥ 8 under protan/deutan simulation across every pair, and exceed 3:1
 * contrast. Slot 0 is the brand amber, stepped down slightly to fit the band.
 *
 * Colour follows the load, never its position in a filtered list, so the caller
 * passes the colour in with the series.
 */
export const SERIES_COLORS = ['#C08209', '#5590D0', '#44A06A'] as const;

const AXIS = '#5C5C70';
const GRID = '#292944';
const SURFACE = '#22223A';

export interface ChartSeries {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly rows: readonly CalcRow[];
}

type Measure = 'drop' | 'velocity' | 'energy' | 'drift';

interface MeasureSpec {
  readonly label: string;
  readonly axisLabel: (units: FormUnits) => string;
  readonly value: (row: CalcRow, units: FormUnits) => number;
  readonly digits: number;
  /** Draw the zero line — meaningful for drop and drift, noise for the rest. */
  readonly zeroLine: boolean;
}

const MEASURES: Readonly<Record<Measure, MeasureSpec>> = {
  drop: {
    label: 'Drop',
    axisLabel: (units) => UNIT_LABEL[dropUnitFor(units.smallLength)],
    value: (row, units) => convertLength(row.pathM, 'm', dropUnitFor(units.smallLength)),
    digits: 1,
    zeroLine: true,
  },
  velocity: {
    label: 'Velocity',
    axisLabel: (units) => UNIT_LABEL[units.velocity],
    value: (row, units) => convertVelocity(row.velocityMps, 'mps', units.velocity),
    digits: 0,
    zeroLine: false,
  },
  energy: {
    label: 'Energy',
    axisLabel: (units) => UNIT_LABEL[units.energy],
    value: (row, units) => convertEnergy(row.energyJ, 'J', units.energy),
    digits: 0,
    zeroLine: false,
  },
  drift: {
    label: 'Drift',
    axisLabel: (units) => UNIT_LABEL[dropUnitFor(units.smallLength)],
    value: (row, units) => convertLength(row.windageM, 'm', dropUnitFor(units.smallLength)),
    digits: 1,
    zeroLine: true,
  },
};

export function CalcCharts({
  series,
  units,
}: {
  readonly series: readonly ChartSeries[];
  readonly units: FormUnits;
}): ReactElement {
  return (
    <Tabs defaultValue="drop">
      <TabsList>
        {(Object.keys(MEASURES) as Measure[]).map((measure) => (
          <TabsTrigger key={measure} value={measure}>
            {MEASURES[measure].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(MEASURES) as Measure[]).map((measure) => (
        <TabsContent key={measure} value={measure}>
          <MeasureChart measure={measure} series={series} units={units} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MeasureChart({
  measure,
  series,
  units,
}: {
  readonly measure: Measure;
  readonly series: readonly ChartSeries[];
  readonly units: FormUnits;
}): ReactElement {
  const spec = MEASURES[measure];

  const data = useMemo(() => {
    const byRange = new Map<number, Record<string, number>>();
    for (const line of series) {
      for (const row of line.rows) {
        const range = convertLength(row.rangeM, 'm', units.range);
        const key = Math.round(range * 100) / 100;
        const entry = byRange.get(key) ?? { range: key };
        entry[line.id] = spec.value(row, units);
        byRange.set(key, entry);
      }
    }
    return [...byRange.values()].sort((a, b) => (a.range ?? 0) - (b.range ?? 0));
  }, [series, spec, units]);

  const multi = series.length > 1;

  return (
    <figure className="rounded-card border border-gunmetal-700 bg-gunmetal-850/60 p-3">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink-300">
          {spec.label}{' '}
          <span className="font-normal text-ink-700">
            ({spec.axisLabel(units)} vs {UNIT_LABEL[units.range]})
          </span>
        </span>
        {multi ? (
          <span className="flex flex-wrap gap-3">
            {series.map((line) => (
              <span key={line.id} className="flex items-center gap-1.5 text-xs text-ink-500">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                {line.label}
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>

      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="range"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <YAxis
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              // Axis ticks stay compact; the tooltip carries the precision.
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            {spec.zeroLine ? <ReferenceLine y={0} stroke={AXIS} strokeDasharray="4 4" /> : null}
            <Tooltip
              cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
              content={(props: TooltipContentProps) => (
                <ChartTooltip {...props} series={series} units={units} spec={spec} />
              )}
            />
            {series.map((line) => (
              <Line
                key={line.id}
                type="monotone"
                dataKey={line.id}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  units,
  spec,
}: TooltipContentProps & {
  readonly series: readonly ChartSeries[];
  readonly units: FormUnits;
  readonly spec: MeasureSpec;
}): ReactElement | null {
  if (active !== true || !payload || payload.length === 0) return null;

  return (
    <div className="rounded border border-gunmetal-700 bg-gunmetal-950/95 px-3 py-2 shadow-lg shadow-black/50">
      <p className="num mb-1 text-xs text-ink-500">
        {typeof label === 'number' ? label.toFixed(0) : String(label)} {UNIT_LABEL[units.range]}
      </p>
      <ul className="space-y-0.5">
        {payload.map((entry) => {
          const line = series.find((s) => s.id === entry.dataKey);
          return (
            <li key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: line?.color ?? AXIS }}
              />
              {series.length > 1 ? (
                <span className="text-ink-500">{line?.label ?? entry.name}</span>
              ) : null}
              <span className="num ml-auto text-ink-100">
                {typeof entry.value === 'number' ? entry.value.toFixed(spec.digits) : '—'}{' '}
                <span className="text-ink-700">{spec.axisLabel(units)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
