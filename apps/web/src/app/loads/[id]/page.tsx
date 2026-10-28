'use client';

import {
  Archive,
  Calculator,
  Copy,
  FileText,
  Gauge,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { LoadEditor } from '@/components/profiles/load-editor';
import { TruingPanel } from '@/components/profiles/truing-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { describeLoad, effectiveMuzzleVelocity, formFromProfile } from '@/lib/profiles/to-form';
import { getStore } from '@/lib/store';
import { duplicateLoad, touch } from '@/lib/store/factories';
import { useProfile } from '@/lib/store/hooks';
import type { StoredLoad } from '@/lib/store/types';

export default function LoadDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data, loading, refresh } = useProfile(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  const { load, rifle } = data;
  if (load === null || rifle === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          title="No such load"
          body="It may have been deleted, or saved in a different browser."
          action={
            <Button asChild variant="primary">
              <Link href="/rifles">Back to rifles</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const save = (next: StoredLoad): void => {
    void getStore()
      .saveLoad(touch(next))
      .then(() => {
        setEditing(false);
        refresh();
      });
  };

  const form = formFromProfile(rifle, load, DEFAULT_FORM);
  const mv = effectiveMuzzleVelocity(load, DEFAULT_FORM.temperature);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href="/rifles" className="hover:text-ink-300">
          Rifles
        </Link>
        <span className="px-1.5">/</span>
        <Link href={`/rifles/${rifle.id}`} className="hover:text-ink-300">
          {rifle.name}
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">{load.name}</span>
      </nav>

      <PageHeader
        title={load.name}
        subtitle={describeLoad(load)}
        actions={
          editing ? null : (
            <>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const copy = duplicateLoad(load);
                  void getStore()
                    .saveLoad(copy)
                    .then(() => {
                      router.push(`/loads/${copy.id}`);
                    });
                }}
              >
                <Copy aria-hidden="true" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void getStore()
                    .saveLoad(touch({ ...load, archived: true }))
                    .then(() => {
                      router.push(`/rifles/${rifle.id}`);
                    });
                }}
              >
                <Archive aria-hidden="true" />
                Archive
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="primary">
          <Link href={`/calc?load=${load.id}`}>
            <Calculator aria-hidden="true" />
            Open in the calculator
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/dope/${load.id}`}>
            <FileText aria-hidden="true" />
            DOPE card
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/range?load=${load.id}`}>
            <Gauge aria-hidden="true" />
            Range mode
          </Link>
        </Button>
      </div>

      {editing ? (
        <Card>
          <CardBody>
            <LoadEditor
              load={load}
              onSave={save}
              onCancel={() => {
                setEditing(false);
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label="Bullet" value={load.bullet.name} />
              <Stat label="Weight" value={`${String(load.bullet.weightGr)} gr`} />
              <Stat
                label={`BC (${load.bullet.bcType})`}
                value={String(load.bullet.bcValue)}
                badge={load.bullet.verified ? null : <Badge tone="warn">Unverified</Badge>}
              />
              <Stat label="Entered MV" value={`${String(load.muzzleVelocityFps)} fps`} />
            </dl>

            <div className="mt-4 space-y-2 border-t border-gunmetal-700 pt-4 text-sm">
              <p className="text-ink-300">
                Solving at 59 °F uses{' '}
                <span className="num font-semibold text-forge-500">{String(mv.fps)} fps</span>{' '}
                <span className="text-ink-500">({mv.source})</span>
              </p>
              {mv.trued ? (
                <p className="num text-xs text-ink-500">
                  Trued to {String(load.truedMuzzleVelocityFps?.value)} fps on{' '}
                  {load.truedMuzzleVelocityFps?.at} at{' '}
                  {String(load.truedMuzzleVelocityFps?.atRangeYd)} yd. The entered{' '}
                  {String(load.muzzleVelocityFps)} fps is kept.
                </p>
              ) : null}
              {mv.temperatureAdjustmentFps === 0 ? null : (
                <p className="num text-xs text-ink-500">
                  Powder temperature correction: {mv.temperatureAdjustmentFps > 0 ? '+' : ''}
                  {String(mv.temperatureAdjustmentFps)} fps from{' '}
                  {String(load.muzzleVelocityAtTempF)} °F at{' '}
                  {String(load.temperatureSensitivityFpsPerF)} fps/°F.
                </p>
              )}
              {load.truedBcScale === undefined ? null : (
                <p className="num text-xs text-ink-500">
                  BC scale {String(load.truedBcScale.value)} trued on {load.truedBcScale.at} at{' '}
                  {String(load.truedBcScale.atRangeYd)} yd.
                </p>
              )}
            </div>

            {load.truedMuzzleVelocityFps === undefined && load.truedBcScale === undefined ? null : (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  const { truedMuzzleVelocityFps: _mv, truedBcScale: _bc, ...rest } = load;
                  save(rest);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Clear trued values
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <TruingPanel form={form} load={load} onApply={save} />

      <section className="border-t border-gunmetal-700 pt-5">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3">
            <p className="flex-1 text-sm text-fail-500">
              Delete {load.name}? This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void getStore()
                  .deleteLoad(load.id)
                  .then(() => {
                    router.push(`/rifles/${rifle.id}`);
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
            Delete this load
          </Button>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  badge,
}: {
  readonly label: string;
  readonly value: string;
  readonly badge?: ReactElement | null;
}): ReactElement {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-700">{label}</dt>
      <dd className="num mt-0.5 flex items-center gap-1.5 text-ink-100">
        {value}
        {badge}
      </dd>
    </div>
  );
}
