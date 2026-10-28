'use client';

import { ChevronRight, Plus, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { SuppressorEditor } from '@/components/suppressors/suppressor-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { getStore } from '@/lib/store';
import { newSuppressor, touch } from '@/lib/store/factories';
import { useSuppressors } from '@/lib/store/hooks';
import type { StoredSuppressor } from '@/lib/store/types';

export default function SuppressorsPage(): ReactElement {
  const { data: suppressors, loading, refresh } = useSuppressors();
  const [creating, setCreating] = useState<StoredSuppressor | null>(null);

  const save = (suppressor: StoredSuppressor): void => {
    void getStore()
      .saveSuppressor(touch(suppressor))
      .then(() => {
        setCreating(null);
        refresh();
      });
  };

  const active = suppressors.filter((entry) => entry.archived !== true);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="The Can"
        subtitle="Suppressor specs, compatibility, and your own measured velocity deltas"
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/suppressors/compatibility">
                <SlidersHorizontal aria-hidden="true" />
                Compatibility
              </Link>
            </Button>
            {creating === null ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreating(newSuppressor());
                }}
              >
                <Plus aria-hidden="true" />
                Add
              </Button>
            ) : null}
          </>
        }
      />

      <p className="rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3 text-sm text-ink-500">
        The shared suppressor library has no entries yet, because its specifications have to come
        from manufacturer pages and none could be sourced during the build. Add your own from the
        box or the maker&rsquo;s site and everything here works against it.
      </p>

      {creating === null ? null : (
        <Card>
          <CardBody>
            <SuppressorEditor
              suppressor={creating}
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
          title="No suppressors yet"
          body="Add a can with the figures from the manufacturer, and you can check it against every rifle you own and record what it does to your velocity."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setCreating(newSuppressor());
              }}
            >
              <Plus aria-hidden="true" />
              Add a suppressor
            </Button>
          }
        />
      ) : null}

      <ul className="space-y-3">
        {active.map((suppressor) => (
          <li key={suppressor.id}>
            <Link
              href={`/suppressors/${suppressor.id}`}
              className="flex items-center gap-3 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3 transition-colors hover:border-forge-600 hover:bg-gunmetal-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-100">
                  {suppressor.manufacturer === undefined
                    ? suppressor.name
                    : `${suppressor.manufacturer} ${suppressor.name}`}
                </span>
                <span className="num block truncate text-xs text-ink-500">
                  {describeSuppressor(suppressor)}
                </span>
              </span>
              {suppressor.verified ? null : (
                <Badge tone="warn" className="shrink-0">
                  Unverified
                </Badge>
              )}
              <ChevronRight className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeSuppressor(suppressor: StoredSuppressor): string {
  const parts: string[] = [];
  if (suppressor.boreDiameterIn !== undefined) {
    parts.push(`${suppressor.boreDiameterIn.toFixed(3)} in bore`);
  }
  if (suppressor.threadPitch !== undefined) parts.push(suppressor.threadPitch);
  if (suppressor.weightOz !== undefined) parts.push(`${String(suppressor.weightOz)} oz`);
  if (suppressor.lengthIn !== undefined) parts.push(`${String(suppressor.lengthIn)} in`);
  return parts.length === 0 ? 'No specifications recorded' : parts.join(' · ');
}
