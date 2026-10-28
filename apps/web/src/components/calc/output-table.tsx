'use client';

import type { ReactElement, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  UNIT_LABEL,
  dropUnitFor,
  fmtClicks,
  fmtCorrection,
  fmtDrop,
  fmtEnergy,
  fmtRange,
  fmtTime,
  fmtVelocity,
} from '@/lib/calc/format';
import type { CalcResult } from '@/lib/calc/solve';
import type { FormUnits } from '@/lib/calc/types';
import { cn } from '@/lib/utils';

export interface OutputTableProps {
  readonly result: CalcResult;
  readonly units: FormUnits;
}

/**
 * The solution table. The header is sticky and the range column is pinned, so
 * on a phone you can scroll sideways through velocity and energy without losing
 * track of which distance you are reading.
 */
export function OutputTable({ result, units }: OutputTableProps): ReactElement {
  const angular = UNIT_LABEL[units.angular];
  const dropUnit = UNIT_LABEL[dropUnitFor(units.smallLength)];

  return (
    <div className="scroll-slim overflow-x-auto rounded-card border border-gunmetal-700">
      <table className="w-full border-collapse text-right text-sm">
        <caption className="sr-only">
          Ballistic solution by range. Transonic and subsonic rows are flagged.
        </caption>
        <thead className="sticky top-0 z-10 bg-gunmetal-850">
          <tr className="text-[0.6875rem] uppercase tracking-wide text-ink-500">
            <Th className="sticky left-0 z-20 bg-gunmetal-850 text-left">
              Range
              <Unit>{UNIT_LABEL[units.range]}</Unit>
            </Th>
            <Th>
              Elev
              <Unit>{angular}</Unit>
            </Th>
            <Th>
              Elev
              <Unit>clicks</Unit>
            </Th>
            <Th>
              Wind
              <Unit>{angular}</Unit>
            </Th>
            <Th>
              Wind
              <Unit>clicks</Unit>
            </Th>
            <Th>
              Drop
              <Unit>{dropUnit}</Unit>
            </Th>
            <Th>
              Drift
              <Unit>{dropUnit}</Unit>
            </Th>
            <Th>
              Vel
              <Unit>{UNIT_LABEL[units.velocity]}</Unit>
            </Th>
            <Th>
              Energy
              <Unit>{UNIT_LABEL[units.energy]}</Unit>
            </Th>
            <Th>
              TOF
              <Unit>s</Unit>
            </Th>
          </tr>
        </thead>
        <tbody className="num">
          {result.rows.map((row) => {
            const flagged = row.regime !== 'supersonic';
            return (
              <tr
                key={row.rangeM}
                className={cn(
                  'border-t border-gunmetal-800',
                  flagged && 'bg-fail-500/5',
                  row.regime === 'transonic' && 'bg-warn-500/5',
                )}
              >
                <Td
                  className={cn(
                    'sticky left-0 z-10 text-left font-semibold text-ink-100',
                    flagged ? 'bg-gunmetal-850' : 'bg-gunmetal-900',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {fmtRange(row.rangeM, units.range)}
                    {row.regime === 'transonic' ? (
                      <Badge
                        tone="warn"
                        title="Transonic: Mach 1.2 or below. Point-mass drag models lose accuracy here."
                      >
                        T
                      </Badge>
                    ) : null}
                    {row.regime === 'subsonic' ? (
                      <Badge tone="fail" title="Subsonic: below the speed of sound.">
                        S
                      </Badge>
                    ) : null}
                  </span>
                </Td>
                <Td className="text-forge-500">{fmtCorrection(row.elevation, units.angular)}</Td>
                <Td className="text-ink-500">{fmtClicks(row.elevation)}</Td>
                <Td className="text-forge-500">{fmtCorrection(row.windage, units.angular)}</Td>
                <Td className="text-ink-500">{fmtClicks(row.windage)}</Td>
                <Td>{fmtDrop(row.pathM, units.smallLength)}</Td>
                <Td>{fmtDrop(row.windageM, units.smallLength)}</Td>
                <Td>{fmtVelocity(row.velocityMps, units.velocity)}</Td>
                <Td>{fmtEnergy(row.energyJ, units.energy)}</Td>
                <Td>{fmtTime(row.timeS)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): ReactElement {
  return (
    <th scope="col" className={cn('whitespace-nowrap px-3 py-2 font-medium', className)}>
      <span className="flex flex-col leading-tight">{children}</span>
    </th>
  );
}

function Unit({ children }: { readonly children: ReactNode }): ReactElement {
  return <span className="text-[0.625rem] font-normal normal-case text-ink-500">{children}</span>;
}

function Td({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): ReactElement {
  return <td className={cn('whitespace-nowrap px-3 py-2 text-ink-300', className)}>{children}</td>;
}
