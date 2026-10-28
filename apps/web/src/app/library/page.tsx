'use client';

import { Calculator, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import {
  BULLETS,
  LIBRARY_GENERATED_AT,
  calibreOptions,
  manufacturerOptions,
  preferredBc,
  searchBullets,
} from '@/lib/library';

const ANY = '__any__';

export default function LibraryPage(): ReactElement {
  const [query, setQuery] = useState('');
  const [diameter, setDiameter] = useState(ANY);
  const [manufacturer, setManufacturer] = useState(ANY);
  const [bcType, setBcType] = useState<'any' | 'G1' | 'G7'>('any');

  const results = useMemo(
    () =>
      searchBullets({
        query,
        ...(diameter === ANY ? {} : { diameterIn: diameter }),
        ...(manufacturer === ANY ? {} : { manufacturer }),
        ...(bcType === 'any' ? {} : { bcType }),
      }),
    [query, diameter, manufacturer, bcType],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        title="Library"
        subtitle={`${String(BULLETS.length)} bullets, transcribed from manufacturer pages`}
      />

      <p className="rounded-card border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
        <strong>Nothing here is verified yet.</strong> Every row carries the page it came from, but
        no human has checked them one by one, so each is badged unverified until someone does.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="lib-search">Search</Label>
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3 size-4 text-ink-700"
              aria-hidden="true"
            />
            <Input
              id="lib-search"
              className="pl-9 font-sans"
              placeholder="eld 140"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lib-calibre">Calibre</Label>
          <Select
            id="lib-calibre"
            value={diameter}
            onValueChange={setDiameter}
            options={[{ value: ANY, label: 'Any calibre' }, ...calibreOptions()]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lib-manufacturer">Manufacturer</Label>
          <Select
            id="lib-manufacturer"
            value={manufacturer}
            onValueChange={setManufacturer}
            options={[{ value: ANY, label: 'Any manufacturer' }, ...manufacturerOptions()]}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Published BC</Label>
          <Segmented
            ariaLabel="Ballistic coefficient type"
            className="w-full [&>button]:flex-1"
            value={bcType}
            onChange={setBcType}
            options={[
              { value: 'any', label: 'Either' },
              { value: 'G1', label: 'Has G1' },
              { value: 'G7', label: 'Has G7' },
            ]}
          />
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a shorter search, or widen the calibre and manufacturer filters."
        />
      ) : (
        <div className="scroll-slim overflow-x-auto rounded-card border border-gunmetal-700">
          <table className="w-full border-collapse text-right text-sm">
            <thead className="bg-gunmetal-850 text-[0.6875rem] uppercase tracking-wide text-ink-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Bullet
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Calibre
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Weight
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  G1
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  G7
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="num">
              {results.map((bullet) => {
                const bc = preferredBc(bullet);
                return (
                  <tr key={bullet.id} className="border-t border-gunmetal-800">
                    <td className="px-3 py-2 text-left">
                      <span className="block text-ink-100">{bullet.name}</span>
                      <span className="flex items-center gap-2 text-xs text-ink-500">
                        {bullet.manufacturer}
                        <Badge tone="warn">Unverified</Badge>
                        <a
                          className="inline-flex items-center gap-0.5 text-forge-500 underline"
                          href={bullet.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          source
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-300">{bullet.diameterIn.toFixed(3)}</td>
                    <td className="px-3 py-2 text-ink-300">{bullet.weightGr}</td>
                    <td className="px-3 py-2 text-ink-300">{bullet.bcG1 ?? '—'}</td>
                    <td className="px-3 py-2 text-forge-500">{bullet.bcG7 ?? '—'}</td>
                    <td className="px-3 py-2">
                      {bc === null ? null : (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/calc?bullet=${bullet.id}`}>
                            <Calculator aria-hidden="true" />
                            Use
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-700">
        Generated {LIBRARY_GENERATED_AT}. Something wrong?{' '}
        <Link href="/feedback" className="text-forge-500 underline">
          Suggest a correction
        </Link>{' '}
        and it goes to the review queue rather than being changed silently.
      </p>
    </div>
  );
}
