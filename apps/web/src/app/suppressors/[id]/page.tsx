'use client';

import { checkSuppressorFit, type HostFitSpec, type SuppressorFitSpec } from '@bf/engine';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { FitVerdict } from '@/components/suppressors/fit-result';
import { MOUNT_OPTIONS, SuppressorEditor } from '@/components/suppressors/suppressor-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { OptionalNumberField } from '@/components/ui/field';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { DEFAULT_FLAGS } from '@/lib/flags';
import { getStore } from '@/lib/store';
import { newSuppressorSetup, touch } from '@/lib/store/factories';
import { useLoads, useRifles, useSuppressor, useSuppressorSetups } from '@/lib/store/hooks';
import type { StoredRifle, StoredSuppressor, StoredSuppressorSetup } from '@/lib/store/types';
import { resolveSuppressorDelta } from '@/lib/suppressors/resolve';

export default function SuppressorDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: suppressor, loading, refresh } = useSuppressor(params.id);
  const { data: rifles } = useRifles();
  const { data: loads } = useLoads();
  const { data: setups, refresh: refreshSetups } = useSuppressorSetups();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (suppressor === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          title="No such suppressor"
          body="It may have been deleted, or saved in a different browser."
          action={
            <Button asChild variant="primary">
              <Link href="/suppressors">Back to The Can</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const save = (next: StoredSuppressor): void => {
    void getStore()
      .saveSuppressor(touch(next))
      .then(() => {
        setEditing(false);
        refresh();
      });
  };

  const spec = toFitSpec(suppressor);
  const activeRifles = rifles.filter((rifle) => rifle.archived !== true);
  const mountLabel =
    MOUNT_OPTIONS.find((option) => option.value === suppressor.mountType)?.label ??
    suppressor.mountType;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href="/suppressors" className="hover:text-ink-300">
          The Can
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">{suppressor.name}</span>
      </nav>

      <PageHeader
        title={
          suppressor.manufacturer === undefined
            ? suppressor.name
            : `${suppressor.manufacturer} ${suppressor.name}`
        }
        subtitle={mountLabel}
        actions={
          editing ? null : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          )
        }
      />

      {editing ? (
        <Card>
          <CardBody>
            <SuppressorEditor
              suppressor={suppressor}
              onSave={save}
              onCancel={() => {
                setEditing(false);
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Specification</CardTitle>
            {suppressor.verified ? (
              <Badge tone="pass">Verified</Badge>
            ) : (
              <Badge tone="warn">Unverified</Badge>
            )}
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Spec label="Mount" value={mountLabel} />
              <Spec label="Thread" value={suppressor.threadPitch} />
              <Spec
                label="Bore"
                value={
                  suppressor.boreDiameterIn === undefined
                    ? undefined
                    : `${suppressor.boreDiameterIn.toFixed(3)} in`
                }
              />
              <Spec label="Max rated" value={suppressor.maxRatedCartridge} />
              <Spec
                label="Length"
                value={
                  suppressor.lengthIn === undefined
                    ? undefined
                    : `${String(suppressor.lengthIn)} in`
                }
              />
              <Spec
                label="Diameter"
                value={
                  suppressor.diameterIn === undefined
                    ? undefined
                    : `${String(suppressor.diameterIn)} in`
                }
              />
              <Spec
                label="Weight"
                value={
                  suppressor.weightOz === undefined
                    ? undefined
                    : `${String(suppressor.weightOz)} oz`
                }
              />
              <Spec
                label="Rated cartridges"
                value={
                  suppressor.ratedCartridges.length === 0
                    ? undefined
                    : String(suppressor.ratedCartridges.length)
                }
              />
            </dl>

            {suppressor.ratedCartridges.length === 0 ? null : (
              <p className="num mt-4 border-t border-gunmetal-700 pt-3 text-xs text-ink-500">
                {suppressor.ratedCartridges.join(' · ')}
              </p>
            )}

            {suppressor.minBarrelLengthNote === undefined ? null : (
              <p className="mt-3 rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
                <strong>Manufacturer restriction, quoted verbatim:</strong>{' '}
                {suppressor.minBarrelLengthNote}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 border-t border-gunmetal-700 pt-3 text-xs">
              {suppressor.sourceUrl === undefined ? (
                <span className="text-ink-500">No source recorded.</span>
              ) : (
                <a
                  className="flex items-center gap-1 text-forge-500 underline"
                  href={suppressor.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Manufacturer page
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
              <a
                className="flex items-center gap-1 text-forge-500 underline"
                href={`https://pewscience.com/?s=${encodeURIComponent(suppressor.name)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Search PEW Science
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          </CardBody>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-300">
          On your rifles
        </h2>

        {activeRifles.length === 0 ? (
          <EmptyState
            title="No rifles to check against"
            body="Add a rifle and this will show whether the can fits it and what it does to your velocity."
            action={
              <Button asChild variant="primary">
                <Link href="/rifles">Add a rifle</Link>
              </Button>
            }
          />
        ) : (
          activeRifles.map((rifle) => (
            <RifleFit
              key={rifle.id}
              rifle={rifle}
              spec={spec}
              bulletDiameterIn={
                loads.find((load) => load.rifleId === rifle.id)?.bullet.diameterIn ?? null
              }
              setup={
                setups.find((s) => s.rifleId === rifle.id && s.suppressorId === suppressor.id) ??
                null
              }
              onSaveSetup={(setup) => {
                void getStore().saveSuppressorSetup(touch(setup)).then(refreshSetups);
              }}
              suppressorId={suppressor.id}
            />
          ))
        )}
      </section>

      <section className="border-t border-gunmetal-700 pt-5">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3">
            <p className="flex-1 text-sm text-fail-500">
              Delete {suppressor.name} and any measurements recorded against it?
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void getStore()
                  .deleteSuppressor(suppressor.id)
                  .then(() => {
                    router.push('/suppressors');
                  });
              }}
            >
              Delete permanently
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Keep it
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete this suppressor
          </Button>
        )}
      </section>
    </div>
  );
}

function RifleFit({
  rifle,
  spec,
  bulletDiameterIn,
  setup,
  suppressorId,
  onSaveSetup,
}: {
  readonly rifle: StoredRifle;
  readonly spec: SuppressorFitSpec;
  readonly bulletDiameterIn: number | null;
  readonly setup: StoredSuppressorSetup | null;
  readonly suppressorId: string;
  readonly onSaveSetup: (setup: StoredSuppressorSetup) => void;
}): ReactElement {
  const host: HostFitSpec = {
    ...(rifle.cartridge === '' ? {} : { cartridge: rifle.cartridge }),
    ...(bulletDiameterIn === null ? {} : { bulletDiameterIn }),
    ...(rifle.threadPitch === undefined ? {} : { threadPitch: rifle.threadPitch }),
    ...(rifle.barrelLengthIn === undefined ? {} : { barrelLengthIn: rifle.barrelLengthIn }),
  };

  const result = checkSuppressorFit(spec, host);
  const current = setup ?? newSuppressorSetup(rifle.id, suppressorId);
  const resolved = resolveSuppressorDelta(setup, null, DEFAULT_FLAGS);

  // exactOptionalPropertyTypes rejects an explicit undefined through Partial<T>,
  // and clearing a measurement back to "unknown" is exactly what these do.
  type SetupPatch = { [K in keyof StoredSuppressorSetup]?: StoredSuppressorSetup[K] | undefined };
  const update = (patch: SetupPatch): void => {
    onSaveSetup({ ...current, ...patch } as StoredSuppressorSetup);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rifle.name}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <FitVerdict result={result} />

        <div className="space-y-3 border-t border-gunmetal-700 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Your measurements
          </h3>
          <p className="text-xs text-ink-500">{resolved.explanation}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <OptionalNumberField
              label="Velocity delta"
              suffix="fps"
              step={1}
              value={current.mvDeltaFps ?? null}
              onChange={(value) => {
                update({ mvDeltaFps: value ?? undefined });
              }}
              emptyHelp="Unknown. The solver will use your unsuppressed velocity."
              help="Suppressed minus unsuppressed, same session, same ammunition."
            />
            <OptionalNumberField
              label="Measured at"
              suffix="yd"
              value={current.measuredAtYd ?? null}
              onChange={(value) => {
                update({ measuredAtYd: value ?? undefined });
              }}
              emptyHelp="Needed before a point-of-impact shift can be used."
            />
            <OptionalNumberField
              label="POI shift, vertical"
              suffix="in"
              step={0.1}
              value={current.poiVerticalIn ?? null}
              onChange={(value) => {
                update({ poiVerticalIn: value ?? undefined });
              }}
              emptyHelp="Unknown. Positive is high."
            />
            <OptionalNumberField
              label="POI shift, horizontal"
              suffix="in"
              step={0.1}
              value={current.poiHorizontalIn ?? null}
              onChange={(value) => {
                update({ poiHorizontalIn: value ?? undefined });
              }}
              emptyHelp="Unknown. Positive is right."
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function toFitSpec(suppressor: StoredSuppressor): SuppressorFitSpec {
  return {
    mountType: suppressor.mountType,
    ratedCartridges: suppressor.ratedCartridges,
    modelName: suppressor.name,
    ...(suppressor.threadPitch === undefined ? {} : { threadPitch: suppressor.threadPitch }),
    ...(suppressor.boreDiameterIn === undefined
      ? {}
      : { boreDiameterIn: suppressor.boreDiameterIn }),
    ...(suppressor.maxRatedCartridge === undefined
      ? {}
      : { maxRatedCartridge: suppressor.maxRatedCartridge }),
    ...(suppressor.minBarrelLengthNote === undefined
      ? {}
      : { minBarrelLengthNote: suppressor.minBarrelLengthNote }),
  };
}

function Spec({
  label,
  value,
}: {
  readonly label: string;
  readonly value?: string | undefined;
}): ReactElement {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="num mt-0.5 text-ink-100">
        {value === undefined ? <span className="text-ink-500">unknown</span> : value}
      </dd>
    </div>
  );
}
