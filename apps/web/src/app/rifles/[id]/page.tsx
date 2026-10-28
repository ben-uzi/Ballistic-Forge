'use client';

import { Archive, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { RifleEditor } from '@/components/profiles/rifle-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { describeLoad, describeRifle } from '@/lib/profiles/to-form';
import { getStore } from '@/lib/store';
import { duplicateRifle, newLoad, touch } from '@/lib/store/factories';
import { useLoads, useRifle } from '@/lib/store/hooks';
import type { StoredRifle } from '@/lib/store/types';

export default function RifleDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: rifle, loading, refresh } = useRifle(id);
  const { data: loads, refresh: refreshLoads } = useLoads(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (rifle === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          title="No such rifle"
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

  const save = (next: StoredRifle): void => {
    void getStore()
      .saveRifle(touch(next))
      .then(() => {
        setEditing(false);
        refresh();
      });
  };

  const addLoad = (): void => {
    const load = newLoad(rifle.id);
    void getStore()
      .saveLoad(load)
      .then(() => {
        router.push(`/loads/${load.id}`);
      });
  };

  const active = loads.filter((load) => load.archived !== true);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href="/rifles" className="hover:text-ink-300">
          Rifles
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">{rifle.name}</span>
      </nav>

      <PageHeader
        title={rifle.name}
        subtitle={describeRifle(rifle)}
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
                  const copy = duplicateRifle(rifle);
                  void getStore()
                    .saveRifle(copy)
                    .then(() => {
                      router.push(`/rifles/${copy.id}`);
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
                    .saveRifle(touch({ ...rifle, archived: true }))
                    .then(() => {
                      router.push('/rifles');
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

      {editing ? (
        <Card>
          <CardBody>
            <RifleEditor
              rifle={rifle}
              onSave={save}
              onCancel={() => {
                setEditing(false);
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-300">Loads</h2>
          <Button variant="outline" size="sm" onClick={addLoad}>
            <Plus aria-hidden="true" />
            New load
          </Button>
        </div>

        {active.length === 0 ? (
          <EmptyState
            title="No loads on this rifle"
            body="A load is a bullet and a muzzle velocity. Add one and you can solve, build a DOPE card and take it to the range."
            action={
              <Button variant="primary" onClick={addLoad}>
                <Plus aria-hidden="true" />
                Add a load
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {active.map((load) => (
              <li key={load.id}>
                <Link
                  href={`/loads/${load.id}`}
                  className="flex items-center gap-3 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3 transition-colors hover:border-forge-600 hover:bg-gunmetal-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-100">{load.name}</span>
                    <span className="num block truncate text-xs text-ink-500">
                      {describeLoad(load)}
                    </span>
                  </span>
                  {load.bullet.verified ? null : (
                    <Badge tone="warn" className="shrink-0">
                      Unverified
                    </Badge>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-ink-700" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-gunmetal-700 pt-5">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3">
            <p className="flex-1 text-sm text-fail-500">
              Delete {rifle.name} and its {String(active.length)} load
              {active.length === 1 ? '' : 's'}? This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void getStore()
                  .deleteRifle(rifle.id)
                  .then(() => {
                    refreshLoads();
                    router.push('/rifles');
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
            Delete this rifle
          </Button>
        )}
      </section>
    </div>
  );
}
