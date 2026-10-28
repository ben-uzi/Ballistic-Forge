'use client';

import { AlertTriangle, Target } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { UNIT_LABEL } from '@/lib/calc/format';
import type { CalcForm } from '@/lib/calc/types';
import { runTruing, truingError, type TruingKind, type TruingOutcome } from '@/lib/profiles/truing';
import type { StoredLoad } from '@/lib/store/types';

/**
 * Truing from one observed impact.
 *
 * The original muzzle velocity and BC are never overwritten — a trued value is
 * stored alongside them with the date and the distance it came from, so it can
 * always be compared with, or reverted to, what was measured.
 */
export function TruingPanel({
  form,
  load,
  onApply,
}: {
  readonly form: CalcForm;
  readonly load: StoredLoad;
  readonly onApply: (load: StoredLoad) => void;
}): ReactElement {
  const [kind, setKind] = useState<TruingKind>('muzzle-velocity');
  const [distance, setDistance] = useState(800);
  const [observed, setObserved] = useState(6.5);
  const [outcome, setOutcome] = useState<TruingOutcome | null>(null);

  const run = (): void => {
    setOutcome(runTruing({ form, kind, distance, observedElevation: observed }));
  };

  const error = outcome === null ? null : truingError(outcome, form.units.angular);

  return (
    <Section
      title="Truing"
      defaultOpen={false}
      summary={
        load.truedMuzzleVelocityFps === undefined && load.truedBcScale === undefined
          ? 'Match the solution to what actually hit'
          : 'Trued'
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Dial a known distance, shoot a group, and tell the solver what actually centred it. It
          works backwards to the muzzle velocity or ballistic coefficient that would have predicted
          your hit.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>What to true</Label>
          <Segmented
            ariaLabel="What to true"
            className="w-full [&>button]:flex-1"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setOutcome(null);
            }}
            options={[
              { value: 'muzzle-velocity', label: 'Muzzle velocity' },
              { value: 'bc-scale', label: 'Ballistic coefficient' },
            ]}
          />
          <p className="text-xs text-ink-500">
            {kind === 'muzzle-velocity'
              ? 'The usual choice. Best at mid range, where velocity dominates the drop.'
              : 'For long range, near the transonic region, once the velocity is already trusted.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Distance"
            suffix={UNIT_LABEL[form.units.range]}
            value={distance}
            onChange={(value) => {
              setDistance(value);
              setOutcome(null);
            }}
          />
          <NumberField
            label="Elevation that centred the group"
            suffix={UNIT_LABEL[form.units.angular]}
            step={0.1}
            value={observed}
            onChange={(value) => {
              setObserved(value);
              setOutcome(null);
            }}
          />
        </div>

        <Button variant="secondary" onClick={run}>
          <Target aria-hidden="true" />
          Work it out
        </Button>

        {outcome === null ? null : (
          <div className="space-y-3 rounded-card border border-gunmetal-700 bg-gunmetal-950/60 p-4">
            {outcome.result.converged ? (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-500">
                      Your profile predicted
                    </dt>
                    <dd className="num text-ink-100">
                      {outcome.predictedElevation === null
                        ? 'could not reach that distance'
                        : `${String(outcome.predictedElevation)} ${UNIT_LABEL[form.units.angular]}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-ink-500">You dialled</dt>
                    <dd className="num text-ink-100">
                      {String(observed)} {UNIT_LABEL[form.units.angular]}
                      {error === null ? null : (
                        <span className="ml-1 text-ink-500">
                          ({error > 0 ? '+' : ''}
                          {String(error)})
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-gunmetal-700 pt-3">
                  {outcome.muzzleVelocity === null ? (
                    <p className="text-sm text-ink-300">
                      Trued ballistic coefficient:{' '}
                      <span className="num font-semibold text-forge-500">
                        {String(outcome.scaledBc)}
                      </span>{' '}
                      <span className="num text-ink-500">
                        (scale {String(outcome.bcScale)}, was {String(form.bcValue)})
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-ink-300">
                      Trued muzzle velocity:{' '}
                      <span className="num font-semibold text-forge-500">
                        {String(outcome.muzzleVelocity)} {UNIT_LABEL[form.units.velocity]}
                      </span>{' '}
                      <span className="num text-ink-500">(was {String(form.muzzleVelocity)})</span>
                    </p>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const at = new Date().toISOString().slice(0, 10);
                    onApply(
                      outcome.muzzleVelocity === null
                        ? {
                            ...load,
                            truedBcScale: {
                              value: outcome.bcScale ?? 1,
                              at,
                              atRangeYd: distance,
                            },
                          }
                        : {
                            ...load,
                            truedMuzzleVelocityFps: {
                              value: outcome.muzzleVelocity,
                              at,
                              atRangeYd: distance,
                            },
                          },
                    );
                  }}
                >
                  Save to this load
                </Button>
                <p className="text-xs text-ink-500">
                  Your original figures are kept. Truing from a single group carries that
                  group&rsquo;s error with it — confirm at another distance before trusting it.
                </p>
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm text-fail-500">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                No value inside the sane bounds produces that impact. Check the distance and the
                elevation you entered, and that the conditions match the day you shot it.
              </p>
            )}

            {outcome.result.warnings.map((warning) => (
              <p
                key={warning.code}
                className="flex items-start gap-2 rounded border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {warning.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
