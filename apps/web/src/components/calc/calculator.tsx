'use client';

import { RotateCcw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { BulletGroup } from './bullet-group';
import { CalcCharts, SERIES_COLORS, type ChartSeries } from './charts';
import { ComparePanel } from './compare-panel';
import { ConditionsGroup } from './conditions-group';
import { SolutionDisclaimer } from './disclaimer';
import { GuestPrompt } from './guest-prompt';
import { OutputTable } from './output-table';
import { RifleGroup } from './rifle-group';
import { SolutionSummary } from './solution-summary';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/field';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { DEFAULT_FORM, METRIC_UNITS, US_UNITS } from '@/lib/calc/defaults';
import { UNIT_LABEL } from '@/lib/calc/format';
import { byField, unmapped } from '@/lib/calc/issues';
import { runCalc } from '@/lib/calc/solve';
import type { CalcForm, CompareLoad, FormUnits } from '@/lib/calc/types';
import { compareLoadWithUnits, withUnits } from '@/lib/calc/units';
import { findBullet, preferredBc } from '@/lib/library';
import { formFromProfile } from '@/lib/profiles/to-form';
import { getStore } from '@/lib/store';

const FORM_KEY = 'bf.calcForm.v1';

export function Calculator(): ReactElement {
  const [form, setForm] = useState<CalcForm>(DEFAULT_FORM);
  const [compareLoads, setCompareLoads] = useState<readonly CompareLoad[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const requestedLoadId = searchParams.get('load');
  const requestedBulletId = searchParams.get('bullet');

  // Restore after mount so the server and first client render agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FORM_KEY);
      if (raw === null) return;
      const saved = JSON.parse(raw) as Partial<CalcForm>;
      setForm((current) => ({
        ...current,
        ...saved,
        units: { ...current.units, ...saved.units },
      }));
    } catch {
      // A corrupt saved form must not keep the calculator from opening.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {
      // Private mode or quota: the session still works.
    }
  }, [form]);

  // `/calc?load=<id>` opens a saved profile. The conditions and output range
  // already on screen are kept; only the rifle and load change.
  useEffect(() => {
    if (requestedLoadId === null) return;
    let cancelled = false;
    void (async () => {
      const store = getStore();
      const load = await store.getLoad(requestedLoadId);
      if (load === null) return;
      const rifle = await store.getRifle(load.rifleId);
      if (rifle === null || cancelled) return;
      setForm((current) => formFromProfile(rifle, load, current));
      setLoadedProfile(`${rifle.name} · ${load.name}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedLoadId]);

  // `/calc?bullet=<id>` loads one row from the library. Only the bullet
  // changes; the rifle, conditions and output range stay as they are.
  useEffect(() => {
    if (requestedBulletId === null) return;
    const bullet = findBullet(requestedBulletId);
    if (bullet === null) return;
    const bc = preferredBc(bullet);
    if (bc === null) return;
    setForm((current) => ({
      ...current,
      bulletName: `${bullet.manufacturer} ${bullet.name}`,
      diameter: current.units.smallLength === 'in' ? bullet.diameterIn : bullet.diameterIn * 25.4,
      weight: current.units.mass === 'gr' ? bullet.weightGr : bullet.weightGr * 0.06479891,
      bcType: bc.type,
      bcValue: bc.value,
      bulletLength:
        bullet.lengthIn === null
          ? null
          : current.units.smallLength === 'in'
            ? bullet.lengthIn
            : bullet.lengthIn * 25.4,
      // Library rows carry a source but no human has checked them.
      dataUnverified: !bullet.verified,
    }));
    setLoadedProfile(`${bullet.manufacturer} ${bullet.name}`);
  }, [requestedBulletId]);

  const set = useCallback(<K extends keyof CalcForm>(key: K, value: CalcForm[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const setUnits = useCallback((next: Partial<FormUnits>): void => {
    setForm((current) => {
      const converted = withUnits(current, next);
      setCompareLoads((loads) =>
        loads.map((load) => compareLoadWithUnits(load, current.units, converted.units)),
      );
      return converted;
    });
  }, []);

  // Keep typing responsive: the solve runs against the settled value.
  const deferredForm = useDeferredValue(form);
  const deferredLoads = useDeferredValue(compareLoads);

  const outcome = useMemo(() => runCalc(deferredForm), [deferredForm]);
  const fieldIssues = useMemo(() => byField(outcome.issues), [outcome.issues]);
  const otherIssues = useMemo(() => unmapped(outcome.issues), [outcome.issues]);

  const comparisons = useMemo(
    () => deferredLoads.map((load) => ({ load, outcome: runCalc(deferredForm, load) })),
    [deferredForm, deferredLoads],
  );

  const series = useMemo((): ChartSeries[] => {
    const list: ChartSeries[] = [];
    if (outcome.ok) {
      list.push({
        id: 'primary',
        label: deferredForm.bulletName.trim() === '' ? 'Load 1' : deferredForm.bulletName,
        color: SERIES_COLORS[0],
        rows: outcome.result.rows,
      });
    }
    comparisons.forEach(({ load, outcome: result }, index) => {
      if (!result.ok) return;
      list.push({
        id: load.id,
        // Colour follows the load's slot, so removing one never repaints the others.
        color: SERIES_COLORS[index + 1] ?? SERIES_COLORS[0],
        label: load.label,
        rows: result.result.rows,
      });
    });
    return list;
  }, [outcome, comparisons, deferredForm.bulletName]);

  const isMetric = form.units.range === 'm';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-100">The Lab</h1>
          <p className="text-sm text-ink-500">
            A point-mass solution with real atmospherics, wind, spin drift and Coriolis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Unit system"
            size="sm"
            value={isMetric ? 'metric' : 'us'}
            onChange={(choice) => {
              setUnits(choice === 'metric' ? METRIC_UNITS : US_UNITS);
            }}
            options={[
              { value: 'us', label: 'US' },
              { value: 'metric', label: 'Metric' },
            ]}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm(DEFAULT_FORM);
              setCompareLoads([]);
            }}
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        </div>
      </header>

      {loadedProfile === null ? null : (
        <p className="rounded-card border border-forge-600/40 bg-forge-500/5 px-4 py-2 text-sm text-ink-300">
          Loaded <span className="num font-semibold text-forge-500">{loadedProfile}</span>
        </p>
      )}

      <GuestPrompt />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <BulletGroup form={form} set={set} setUnits={setUnits} issues={fieldIssues} />
          <RifleGroup form={form} set={set} setUnits={setUnits} issues={fieldIssues} />
          <ConditionsGroup form={form} set={set} setUnits={setUnits} issues={fieldIssues} />
          <ComparePanel form={form} loads={compareLoads} onChange={setCompareLoads} />
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Section title="Output range" defaultOpen>
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label="Start"
                value={form.rangeStart}
                onChange={(value) => {
                  set('rangeStart', value);
                }}
                suffix={UNIT_LABEL[form.units.range]}
              />
              <NumberField
                label="End"
                value={form.rangeEnd}
                onChange={(value) => {
                  set('rangeEnd', value);
                }}
                suffix={UNIT_LABEL[form.units.range]}
              />
              <NumberField
                label="Step"
                value={form.rangeStep}
                onChange={(value) => {
                  set('rangeStep', value);
                }}
                suffix={UNIT_LABEL[form.units.range]}
                error={fieldIssues.get('rangeStep')?.message}
              />
            </div>
          </Section>

          {otherIssues.length > 0 ? (
            <ul className="space-y-2">
              {otherIssues.map((issue) => (
                <li
                  key={`${issue.path}:${issue.code}`}
                  className={
                    issue.severity === 'error'
                      ? 'rounded-card border border-fail-500/40 bg-fail-500/10 px-3 py-2 text-xs text-fail-500'
                      : 'rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'
                  }
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          {outcome.ok ? (
            <>
              <SolutionSummary result={outcome.result} units={form.units} />
              {form.dataUnverified ? (
                <p className="rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
                  This bullet&rsquo;s data has not been verified against the manufacturer&rsquo;s
                  published figures.
                </p>
              ) : null}
              <CalcCharts series={series} units={form.units} />
              <OutputTable result={outcome.result} units={form.units} />
              {comparisons.map(({ load, outcome: result }) =>
                result.ok ? null : (
                  <p
                    key={load.id}
                    className="rounded-card border border-fail-500/40 bg-fail-500/10 px-3 py-2 text-xs text-fail-500"
                  >
                    {load.label} could not be solved:{' '}
                    {result.issues.find((i) => i.severity === 'error')?.message ??
                      'check its inputs.'}
                  </p>
                ),
              )}
              <SolutionDisclaimer />
            </>
          ) : (
            <div className="rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-8 text-center">
              <p className="text-sm text-ink-300">No solution yet.</p>
              <p className="mt-1 text-xs text-ink-500">
                Fix the highlighted inputs on the left and the table will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
