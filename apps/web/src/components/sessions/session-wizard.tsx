'use client';

import { importChronoCsv, importPastedVelocities, ChronoImportError } from '@bf/db/chrono';
import { summarize } from '@bf/engine';
import { Check, Plus, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getStore } from '@/lib/store';
import { newSession, newShotString, touch } from '@/lib/store/factories';
import { useLoads, useRifles, useSessions, useSuppressors } from '@/lib/store/hooks';
import type { ChronoType, StoredSession, StoredShotString } from '@/lib/store/types';

const DRAFT_KEY = 'bf.sessionDraft.v1';

const CHRONO_OPTIONS: readonly { value: ChronoType; label: string }[] = [
  { value: 'garmin_xero', label: 'Garmin Xero' },
  { value: 'labradar', label: 'LabRadar' },
  { value: 'magnetospeed', label: 'MagnetoSpeed' },
  { value: 'optical', label: 'Optical (skyscreens)' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Not recorded' },
];

const STEPS = ['Setup', 'Conditions', 'Strings', 'Observations', 'Review'] as const;
type Step = (typeof STEPS)[number];

/**
 * Logging a range session.
 *
 * Five steps, because a session has five genuinely different kinds of input and
 * a single long form at the firing line is unusable. The draft is written to
 * local storage on every change, so closing the tab between strings loses
 * nothing.
 */
export function SessionWizard(): ReactElement {
  const router = useRouter();
  const { data: rifles, loading } = useRifles();
  const { data: loads } = useLoads();
  const { data: suppressors } = useSuppressors();
  const { data: previous } = useSessions();

  const [step, setStep] = useState<Step>('Setup');
  const [draft, setDraft] = useState<StoredSession | null>(null);

  const activeRifles = rifles.filter((rifle) => rifle.archived !== true);
  const activeLoads = loads.filter((load) => load.archived !== true);

  // Start from a saved draft, else a new session pre-filled from last time.
  useEffect(() => {
    if (draft !== null || loading) return;
    const rifle = activeRifles[0];
    if (rifle === undefined) return;
    const load = activeLoads.find((entry) => entry.rifleId === rifle.id);
    if (load === undefined) return;

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw !== null) {
        setDraft(JSON.parse(raw) as StoredSession);
        return;
      }
    } catch {
      // A corrupt draft must not block starting a new session.
    }

    const last = previous[0];
    setDraft(
      newSession(rifle.id, load.id, {
        // Conditions carry over: the weather rarely changes between sessions
        // as much as re-typing it costs at the range.
        chronoType: last?.chronoType ?? 'unknown',
        ...(last?.tempF === undefined ? {} : { tempF: last.tempF }),
        ...(last?.pressure === undefined ? {} : { pressure: last.pressure }),
        ...(last?.pressureType === undefined ? {} : { pressureType: last.pressureType }),
        ...(last?.altitudeFt === undefined ? {} : { altitudeFt: last.altitudeFt }),
        ...(last?.humidityPct === undefined ? {} : { humidityPct: last.humidityPct }),
        ...(last?.regionCoarse === undefined ? {} : { regionCoarse: last.regionCoarse }),
        strings: [newShotString()],
      }),
    );
  }, [draft, loading, activeRifles, activeLoads, previous]);

  useEffect(() => {
    if (draft === null) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Autosave is a convenience; the in-memory draft still works.
    }
  }, [draft]);

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (activeRifles.length === 0 || activeLoads.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="Nothing to log against"
          body="A session belongs to a rifle and a load. Create those first and the Field Database will know what it is looking at."
          action={
            <Button asChild variant="primary">
              <Link href="/rifles">Add a rifle</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (draft === null) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink-500">Preparing…</p>;
  }

  const set = <K extends keyof StoredSession>(key: K, value: StoredSession[K]): void => {
    setDraft((current) => (current === null ? current : { ...current, [key]: value }));
  };

  const riflesLoads = activeLoads.filter((load) => load.rifleId === draft.rifleId);
  const index = STEPS.indexOf(step);

  const submit = (): void => {
    void getStore()
      .saveSession(touch({ ...draft, status: 'submitted' }))
      .then(() => {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // Nothing to do; the session is saved either way.
        }
        router.push(`/sessions/${draft.id}`);
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title="Log a session"
        subtitle={`Step ${String(index + 1)} of ${String(STEPS.length)} — ${step}`}
      />

      <ol className="flex gap-1" aria-label="Progress">
        {STEPS.map((name, position) => (
          <li
            key={name}
            className={`h-1 flex-1 rounded-full ${position <= index ? 'bg-forge-500' : 'bg-gunmetal-700'}`}
          />
        ))}
      </ol>

      {step === 'Setup' ? (
        <Card>
          <CardHeader>
            <CardTitle>What did you shoot?</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-rifle">Rifle</Label>
              <Select
                id="s-rifle"
                value={draft.rifleId}
                onValueChange={(rifleId) => {
                  const firstLoad = activeLoads.find((load) => load.rifleId === rifleId);
                  setDraft((current) =>
                    current === null
                      ? current
                      : { ...current, rifleId, loadId: firstLoad?.id ?? current.loadId },
                  );
                }}
                options={activeRifles.map((rifle) => ({ value: rifle.id, label: rifle.name }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-load">Load</Label>
              <Select
                id="s-load"
                value={draft.loadId}
                onValueChange={(loadId) => {
                  set('loadId', loadId);
                }}
                options={riflesLoads.map((load) => ({ value: load.id, label: load.name }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-date">Date</Label>
              <Input
                id="s-date"
                type="date"
                value={draft.occurredOn}
                onChange={(event) => {
                  set('occurredOn', event.target.value);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-can">Suppressor</Label>
              <Select
                id="s-can"
                placeholder="None"
                value={draft.suppressorId ?? ''}
                onValueChange={(id) => {
                  set('suppressorId', id === '' ? undefined : id);
                }}
                options={suppressors
                  .filter((entry) => entry.archived !== true)
                  .map((entry) => ({ value: entry.id, label: entry.name }))}
              />
              <p className="text-xs text-ink-500">
                Leave as none if you shot it bare. Log both strings in one session and the
                suppressor delta works itself out.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 'Conditions' ? (
        <Card>
          <CardHeader>
            <CardTitle>Chronograph and conditions</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="s-chrono">Chronograph</Label>
              <Select
                id="s-chrono"
                value={draft.chronoType}
                onValueChange={(value) => {
                  set('chronoType', value);
                }}
                options={CHRONO_OPTIONS}
              />
              <p className="text-xs text-ink-500">
                Used to weight your data against everyone else&rsquo;s. Say &ldquo;not
                recorded&rdquo; rather than guessing.
              </p>
            </div>

            <OptionalNumberField
              label="Temperature"
              suffix="°F"
              value={draft.tempF ?? null}
              onChange={(value) => {
                set('tempF', value ?? undefined);
              }}
              emptyHelp="Unknown — your velocities cannot be temperature-normalised."
            />
            <OptionalNumberField
              label="Altitude"
              suffix="ft"
              value={draft.altitudeFt ?? null}
              onChange={(value) => {
                set('altitudeFt', value ?? undefined);
              }}
            />
            <OptionalNumberField
              label="Pressure"
              suffix="inHg"
              step={0.01}
              value={draft.pressure ?? null}
              onChange={(value) => {
                set('pressure', value ?? undefined);
              }}
            />
            <OptionalNumberField
              label="Humidity"
              suffix="%"
              value={draft.humidityPct ?? null}
              onChange={(value) => {
                set('humidityPct', value ?? undefined);
              }}
            />

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="s-region">Region</Label>
              <Input
                id="s-region"
                className="font-sans"
                placeholder="Colorado"
                value={draft.regionCoarse ?? ''}
                onChange={(event) => {
                  set('regionCoarse', event.target.value === '' ? undefined : event.target.value);
                }}
              />
              <p className="text-xs text-ink-500">
                A state or region only. Never an address, a range name or coordinates.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 'Strings' ? (
        <StringsStep
          strings={draft.strings}
          onChange={(strings) => {
            set('strings', strings);
          }}
        />
      ) : null}

      {step === 'Observations' ? (
        <Card>
          <CardHeader>
            <CardTitle>Observed drop and point of impact</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink-500">
              Optional. If you dialled a known distance and centred a group, record it — that is
              what truing works from.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <OptionalNumberField
                label="POI shift, vertical"
                suffix="in"
                step={0.1}
                value={draft.poiVerticalIn ?? null}
                onChange={(value) => {
                  set('poiVerticalIn', value ?? undefined);
                }}
                emptyHelp="Positive is high."
              />
              <OptionalNumberField
                label="POI shift, horizontal"
                suffix="in"
                step={0.1}
                value={draft.poiHorizontalIn ?? null}
                onChange={(value) => {
                  set('poiHorizontalIn', value ?? undefined);
                }}
                emptyHelp="Positive is right."
              />
              <OptionalNumberField
                label="Measured at"
                suffix="yd"
                value={draft.poiDistanceYd ?? null}
                onChange={(value) => {
                  set('poiDistanceYd', value ?? undefined);
                }}
                emptyHelp="Needed to use the shift."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-notes">Notes</Label>
              <Input
                id="s-notes"
                className="font-sans"
                value={draft.notes ?? ''}
                onChange={(event) => {
                  set('notes', event.target.value === '' ? undefined : event.target.value);
                }}
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 'Review' ? <ReviewStep session={draft} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => {
            setStep(STEPS[index - 1] ?? 'Setup');
          }}
        >
          Back
        </Button>

        {step === 'Review' ? (
          <Button variant="primary" onClick={submit}>
            <Check aria-hidden="true" />
            Save session
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              setStep(STEPS[index + 1] ?? 'Review');
            }}
          >
            Next
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-ink-500">
        Saved as a draft in this browser as you go.
      </p>
    </div>
  );
}

function StringsStep({
  strings,
  onChange,
}: {
  readonly strings: readonly StoredShotString[];
  readonly onChange: (strings: readonly StoredShotString[]) => void;
}): ReactElement {
  return (
    <div className="space-y-4">
      {strings.map((entry, position) => (
        <StringCard
          key={entry.id}
          index={position}
          string={entry}
          onChange={(next) => {
            onChange(strings.map((candidate) => (candidate.id === entry.id ? next : candidate)));
          }}
          onRemove={
            strings.length > 1
              ? () => {
                  onChange(strings.filter((candidate) => candidate.id !== entry.id));
                }
              : undefined
          }
        />
      ))}

      <Button
        variant="outline"
        onClick={() => {
          onChange([...strings, newShotString({ suppressed: !(strings[0]?.suppressed ?? false) })]);
        }}
      >
        <Plus aria-hidden="true" />
        Add another string
      </Button>
      <p className="text-xs text-ink-500">
        A suppressed and an unsuppressed string in the same session is how a velocity delta gets
        measured properly.
      </p>
    </div>
  );
}

function StringCard({
  index,
  string,
  onChange,
  onRemove,
}: {
  readonly index: number;
  readonly string: StoredShotString;
  readonly onChange: (next: StoredShotString) => void;
  // Explicitly undefined-able: the last remaining string cannot be removed.
  readonly onRemove?: (() => void) | undefined;
}): ReactElement {
  const [paste, setPaste] = useState('');
  const [importNote, setImportNote] = useState<string | null>(null);
  const summary = string.velocitiesFps.length > 0 ? summarize(string.velocitiesFps) : null;

  const readFile = (file: File): void => {
    void file.text().then((text) => {
      try {
        const result = importChronoCsv(text);
        onChange({ ...string, velocitiesFps: result.velocitiesFps });
        setImportNote(`${result.column}: ${result.note}`);
      } catch (error) {
        setImportNote(
          error instanceof ChronoImportError ? error.message : 'That file could not be read.',
        );
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>String {index + 1}</CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-500">
            Suppressed
            <Switch
              checked={string.suppressed}
              onCheckedChange={(checked) => {
                onChange({ ...string, suppressed: checked });
              }}
              aria-label="Suppressed"
            />
          </label>
          {onRemove === undefined ? null : (
            <Button variant="danger" size="icon" aria-label="Remove string" onClick={onRemove}>
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`paste-${string.id}`}>Velocities</Label>
          <textarea
            id={`paste-${string.id}`}
            rows={3}
            className="num w-full rounded-md border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-base text-ink-100 focus:border-forge-600 focus:outline-none"
            placeholder="2690 2695 2688 2692"
            value={paste}
            onChange={(event) => {
              setPaste(event.target.value);
              onChange({ ...string, velocitiesFps: importPastedVelocities(event.target.value) });
            }}
          />
          <p className="text-xs text-ink-500">
            Paste or type them, separated however you like. Anything that is not a plausible
            velocity is ignored.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-gunmetal-700 bg-gunmetal-800 px-4 text-sm text-ink-100 hover:bg-gunmetal-700">
            <Upload className="size-4" aria-hidden="true" />
            Import a CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) readFile(file);
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-500">
            <Switch
              checked={string.firstRoundCold}
              onCheckedChange={(checked) => {
                onChange({ ...string, firstRoundCold: checked });
              }}
              aria-label="First round from a cold bore"
            />
            First round cold bore
          </label>
        </div>

        {importNote === null ? null : (
          <p className="rounded border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-xs text-ink-500">
            {importNote}
          </p>
        )}

        {summary === null ? (
          <p className="text-xs text-ink-500">No shots yet.</p>
        ) : (
          <dl className="num grid grid-cols-4 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 text-center">
            <Stat label="Shots" value={String(summary.n)} />
            <Stat label="Mean" value={summary.mean.toFixed(0)} />
            <Stat label="SD" value={summary.sd === null ? '—' : summary.sd.toFixed(1)} />
            <Stat label="ES" value={summary.es.toFixed(0)} />
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function ReviewStep({ session }: { readonly session: StoredSession }): ReactElement {
  const totals = useMemo(() => {
    const all = session.strings.flatMap((entry) => entry.velocitiesFps);
    return all.length > 0 ? summarize(all) : null;
  }, [session.strings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {session.strings.map((entry, position) => {
          const summary = entry.velocitiesFps.length > 0 ? summarize(entry.velocitiesFps) : null;
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-card border border-gunmetal-700 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-ink-100">
                String {position + 1}
                {entry.suppressed ? <Badge tone="forge">Suppressed</Badge> : null}
                {entry.firstRoundCold ? <Badge tone="neutral">Cold bore</Badge> : null}
              </span>
              <span className="num text-xs text-ink-500">
                {summary === null
                  ? 'no shots'
                  : `${String(summary.n)} shots · ${summary.mean.toFixed(0)} fps · SD ${summary.sd === null ? '—' : summary.sd.toFixed(1)}`}
              </span>
            </div>
          );
        })}

        {totals === null ? (
          <p className="text-sm text-fail-500">
            No shots recorded. Go back and add at least one velocity.
          </p>
        ) : (
          <dl className="num grid grid-cols-4 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 text-center">
            <Stat label="Shots" value={String(totals.n)} />
            <Stat label="Mean" value={totals.mean.toFixed(0)} />
            <Stat label="SD" value={totals.sd === null ? '—' : totals.sd.toFixed(1)} />
            <Stat label="ES" value={totals.es.toFixed(0)} />
          </dl>
        )}

        <p className="rounded-card border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-xs text-ink-500">
          Saved to this browser. Nothing leaves your device until an account exists to sync it to,
          and contributing to the Field Database will always be something you choose.
        </p>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div className="bg-gunmetal-850 px-2 py-2">
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-100">{value}</dd>
    </div>
  );
}
