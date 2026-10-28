'use client';

import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { RifleEditor } from '@/components/profiles/rifle-editor';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { describeRifle } from '@/lib/profiles/to-form';
import { getStore } from '@/lib/store';
import { newRifle, touch } from '@/lib/store/factories';
import { useLoads, useRifles } from '@/lib/store/hooks';
import type { StoredRifle } from '@/lib/store/types';

export default function RiflesPage(): ReactElement {
  const { data: rifles, loading, refresh } = useRifles();
  const { data: loads, refresh: refreshLoads } = useLoads();
  const [creating, setCreating] = useState<StoredRifle | null>(null);

  const save = (rifle: StoredRifle): void => {
    void getStore()
      .saveRifle(touch(rifle))
      .then(() => {
        setCreating(null);
        refresh();
        refreshLoads();
      });
  };

  const active = rifles.filter((rifle) => rifle.archived !== true);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Rifles"
        subtitle={loading ? 'Loading…' : `${String(active.length)} saved in this browser`}
        actions={
          creating === null ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(newRifle());
              }}
            >
              <Plus aria-hidden="true" />
              New rifle
            </Button>
          ) : null
        }
      />

      {creating === null ? null : (
        <Card>
          <CardBody>
            <RifleEditor
              rifle={creating}
              onSave={save}
              onCancel={() => {
                setCreating(null);
              }}
            />
          </CardBody>
        </Card>
      )}

      {!loading && active.length === 0 && creating === null ? (
        <EmptyState
          title="No rifles yet"
          body="A rifle holds your sight height, zero and turret settings. Loads live under it, so this is the place to start."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setCreating(newRifle());
              }}
            >
              <Plus aria-hidden="true" />
              Add your first rifle
            </Button>
          }
        />
      ) : null}

      <ul className="space-y-3">
        {active.map((rifle) => {
          const count = loads.filter(
            (load) => load.rifleId === rifle.id && load.archived !== true,
          ).length;
          return (
            <li key={rifle.id}>
              <Link
                href={`/rifles/${rifle.id}`}
                className="flex items-center gap-3 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3 transition-colors hover:border-forge-600 hover:bg-gunmetal-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-100">{rifle.name}</span>
                  <span className="num block truncate text-xs text-ink-500">
                    {describeRifle(rifle)}
                  </span>
                </span>
                <span className="num shrink-0 text-xs text-ink-500">
                  {count === 1 ? '1 load' : `${String(count)} loads`}
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-700" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
