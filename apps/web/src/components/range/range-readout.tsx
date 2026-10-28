'use client';

import { Minus, Plus, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { UNIT_LABEL, fmtVelocity } from '@/lib/calc/format';
import { runCalc } from '@/lib/calc/solve';
import { DEFAULT_FLAGS } from '@/lib/flags';
import { formFromProfile } from '@/lib/profiles/to-form';
import { useLoads, useRifles, useSuppressorSetups, useSuppressors } from '@/lib/store/hooks';
import { resolveSuppressorDelta, withSuppressor } from '@/lib/suppressors/resolve';
import { Switch } from '@/components/ui/switch';

const STEP_YD = 25;
const FINE_STEP_YD = 5;
const MIN_YD = 25;
const MAX_YD = 2000;

const CONDITIONS_KEY = 'bf.range.conditions.v1';

/**
 * Range mode: one distance, enormous numbers.
 *
 * Built for a phone held in one hand at the firing line, sometimes with gloves
 * on: every control clears 44 px, the readout is legible at arm's length, and
 * the screen is kept awake while the page is open.
 */
export function RangeReadout(): ReactElement {
  const { data: rifles, loading: riflesLoading } = useRifles();
  const { data: loads } = useLoads();
  const { data: suppressors } = useSuppressors();
  const { data: setups } = useSuppressorSetups();
  const requestedLoadId = useSearchParams().get('load');

  const [loadId, setLoadId] = useState<string | null>(null);
  const [distance, setDistance] = useState(500);
  const [windSpeed, setWindSpeed] = useState(0);
  const [windClock, setWindClock] = useState(3);
  const [suppressed, setSuppressed] = useState(false);

  const activeLoads = useMemo(() => loads.filter((load) => load.archived !== true), [loads]);

  // Pick the requested load, else the first one available.
  useEffect(() => {
    if (loadId !== null) return;
    const wanted = requestedLoadId ?? activeLoads[0]?.id ?? null;
    if (wanted !== null) setLoadId(wanted);
  }, [requestedLoadId, activeLoads, loadId]);

  useWakeLock();

  const load = activeLoads.find((candidate) => candidate.id === loadId) ?? null;
  const rifle = rifles.find((candidate) => candidate.id === load?.rifleId) ?? null;

  // The Can's resolution order: your own measurement, then field data once it
  // is public and plentiful, then nothing at all. Never a generic delta.
  const setup = setups.find((entry) => entry.rifleId === rifle?.id) ?? null;
  const canName = suppressors.find((entry) => entry.id === setup?.suppressorId)?.name ?? null;
  const delta = resolveSuppressorDelta(setup, null, DEFAULT_FLAGS);
  const haveDelta = delta.mvDeltaFps !== null;

  const solution = useMemo(() => {
    if (load === null || rifle === null) return null;
    const stored = readConditions();
    const base = {
      ...DEFAULT_FORM,
      ...stored,
      windSpeed,
      windFromClock: windClock,
      rangeStart: distance,
      rangeEnd: distance,
      rangeStep: Math.max(distance, 1),
    };
    const outcome = runCalc(
      formFromProfile(rifle, load, base),
      undefined,
      suppressed && haveDelta ? (input) => withSuppressor(input, delta) : undefined,
    );
    if (!outcome.ok) return null;
    return { row: outcome.result.rows[0] ?? null, units: base.units, result: outcome.result };
  }, [load, rifle, distance, windSpeed, windClock, suppressed, haveDelta, delta]);

  if (riflesLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (activeLoads.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          title="Nothing to shoot yet"
          body="Range mode reads from a saved rifle and load. Create one and it will show up here."
          action={
            <Button asChild variant="primary">
              <Link href="/rifles">Add a rifle</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const row = solution?.row ?? null;
  const units = solution?.units ?? DEFAULT_FORM.units;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
      <PageHeader title="Range" subtitle={rifle === null ? undefined : rifle.name} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="range-load">Load</Label>
        <Select
          id="range-load"
          value={loadId ?? ''}
          onValueChange={setLoadId}
          options={activeLoads.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          }))}
        />
      </div>

      {/* ── Distance ──────────────────────────────────────────────────────── */}
      <div className="rounded-card border border-gunmetal-700 bg-gunmetal-850/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <StepButton
            label={`Back ${String(STEP_YD)}`}
            onClick={() => {
              setDistance((d) => Math.max(MIN_YD, d - STEP_YD));
            }}
            icon={<Minus aria-hidden="true" />}
          />
          <div className="text-center">
            <p className="num text-5xl font-bold leading-none text-ink-100">{String(distance)}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-ink-700">
              {UNIT_LABEL[units.range]}
            </p>
          </div>
          <StepButton
            label={`Forward ${String(STEP_YD)}`}
            onClick={() => {
              setDistance((d) => Math.min(MAX_YD, d + STEP_YD));
            }}
            icon={<Plus aria-hidden="true" />}
          />
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDistance((d) => Math.max(MIN_YD, d - FINE_STEP_YD));
            }}
          >
            −{FINE_STEP_YD}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDistance((d) => Math.min(MAX_YD, d + FINE_STEP_YD));
            }}
          >
            +{FINE_STEP_YD}
          </Button>
        </div>
      </div>

      {/* ── The numbers ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <BigReadout
          label="Elevation"
          value={row === null ? '—' : fmtBig(row.elevation.value)}
          unit={UNIT_LABEL[units.angular]}
          clicks={row === null ? null : `${String(Math.abs(row.elevation.clicks))} clicks`}
          direction={row?.elevation.direction ?? null}
        />
        <BigReadout
          label="Windage"
          value={row === null ? '—' : fmtBig(row.windage.value)}
          unit={UNIT_LABEL[units.angular]}
          clicks={row === null ? null : `${String(Math.abs(row.windage.clicks))} clicks`}
          direction={row?.windage.direction ?? null}
        />
      </div>

      {row === null ? (
        <p className="rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3 text-sm text-fail-500">
          No solution at that distance. The bullet may not get there with this load.
        </p>
      ) : (
        <dl className="num grid grid-cols-3 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 text-center">
          <SmallStat
            label="Velocity"
            value={`${fmtVelocity(row.velocityMps, units.velocity)} ${UNIT_LABEL[units.velocity]}`}
          />
          <SmallStat label="Mach" value={row.mach.toFixed(2)} />
          <SmallStat label="TOF" value={`${row.timeS.toFixed(2)} s`} />
        </dl>
      )}

      {row !== null && row.regime !== 'supersonic' ? (
        <p className="flex items-center gap-2 rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
          <Badge tone="warn">{row.regime === 'transonic' ? 'Transonic' : 'Subsonic'}</Badge>
          Drag modelling loses accuracy here. Trust it less than the supersonic numbers.
        </p>
      ) : null}

      {/* ── Wind ──────────────────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 p-4">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="range-wind-speed">Wind</Label>
          <span className="num text-sm text-forge-500">
            {String(windSpeed)} {UNIT_LABEL[units.windSpeed]} from {String(windClock)}
          </span>
        </div>
        <Slider
          id="range-wind-speed"
          aria-label="Wind speed"
          min={0}
          max={30}
          step={1}
          value={[windSpeed]}
          onValueChange={(values) => {
            const next = values[0];
            if (next !== undefined) setWindSpeed(next);
          }}
        />
        <Slider
          aria-label="Wind clock position"
          min={1}
          max={12}
          step={1}
          value={[windClock]}
          onValueChange={(values) => {
            const next = values[0];
            if (next !== undefined) setWindClock(next);
          }}
        />
      </div>

      {/* ── Suppressor ────────────────────────────────────────────────────── */}
      <div className="space-y-2 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-ink-100">
            <VolumeX className="size-4 text-ink-500" aria-hidden="true" />
            {canName === null ? 'Suppressed' : canName}
          </span>
          <Switch
            checked={suppressed && haveDelta}
            onCheckedChange={setSuppressed}
            disabled={!haveDelta}
            aria-label="Suppressed"
          />
        </div>
        <p className="text-xs text-ink-700">
          {haveDelta
            ? `${delta.explanation} ${delta.mvDeltaFps === null ? '' : `${delta.mvDeltaFps > 0 ? '+' : ''}${String(delta.mvDeltaFps)} fps`}`
            : delta.explanation}
        </p>
        {haveDelta ? null : (
          <Link href="/suppressors" className="text-xs text-forge-500 underline">
            Record a measurement in The Can
          </Link>
        )}
      </div>

      <p className="text-center text-xs text-ink-700">
        Estimates. Confirm with live fire before you trust them.
      </p>
    </div>
  );
}

function fmtBig(value: number): string {
  return Math.abs(value).toFixed(1);
}

function StepButton({
  label,
  onClick,
  icon,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly icon: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-16 shrink-0 items-center justify-center rounded-full border border-gunmetal-600 bg-gunmetal-800 text-ink-100 transition-colors hover:bg-gunmetal-700 active:bg-gunmetal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge-500 [&_svg]:size-7"
    >
      {icon}
    </button>
  );
}

function BigReadout({
  label,
  value,
  unit,
  clicks,
  direction,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly clicks: string | null;
  readonly direction: 'U' | 'D' | 'L' | 'R' | null;
}): ReactElement {
  return (
    <div className="rounded-card border border-gunmetal-700 bg-gunmetal-950 p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-ink-700">{label}</p>
      <p className="num mt-1 flex items-baseline justify-center gap-1 text-5xl font-bold leading-none text-forge-500">
        {value}
        {direction === null ? null : <span className="text-2xl text-ink-300">{direction}</span>}
      </p>
      <p className="mt-1 text-xs text-ink-500">{unit}</p>
      {clicks === null ? null : <p className="num mt-2 text-sm text-ink-300">{clicks}</p>}
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <div className="bg-gunmetal-850 px-2 py-2">
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-700">{label}</dt>
      <dd className="text-sm text-ink-100">{value}</dd>
    </div>
  );
}

/** Conditions set in the calculator, so range mode is not a second set of inputs. */
function readConditions(): Partial<typeof DEFAULT_FORM> {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      window.localStorage.getItem('bf.calcForm.v1') ?? window.localStorage.getItem(CONDITIONS_KEY);
    if (raw === null) return {};
    const saved = JSON.parse(raw) as Partial<typeof DEFAULT_FORM>;
    return {
      temperature: saved.temperature ?? DEFAULT_FORM.temperature,
      pressure: saved.pressure ?? DEFAULT_FORM.pressure,
      pressureType: saved.pressureType ?? DEFAULT_FORM.pressureType,
      altitude: saved.altitude ?? DEFAULT_FORM.altitude,
      humidity: saved.humidity ?? DEFAULT_FORM.humidity,
      units: saved.units ?? DEFAULT_FORM.units,
    };
  } catch {
    return {};
  }
}

/**
 * Keep the screen on while the page is open.
 *
 * Nothing is worse than the display sleeping between shots. The lock is
 * reacquired when the tab becomes visible again, because browsers drop it on
 * backgrounding.
 */
function useWakeLock(): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;
    const acquire = async (): Promise<void> => {
      try {
        if (document.visibilityState !== 'visible' || cancelled) return;
        sentinel.current = await navigator.wakeLock.request('screen');
      } catch {
        // Denied or unsupported: the page still works, the screen just sleeps.
      }
    };

    const onVisibilityChange = (): void => {
      void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, []);
}
