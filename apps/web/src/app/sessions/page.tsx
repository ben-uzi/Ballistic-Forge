'use client';

import { summarize } from '@bf/engine';
import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { useLoads, useRifles, useSessions } from '@/lib/store/hooks';

export default function SessionsPage(): ReactElement {
  const { data: sessions, loading } = useSessions();
  const { data: rifles } = useRifles();
  const { data: loads } = useLoads();

  const totalShots = sessions.reduce(
    (total, session) =>
      total + session.strings.reduce((sum, string) => sum + string.velocitiesFps.length, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Sessions"
        subtitle={
          loading
            ? 'Loading…'
            : `${String(sessions.length)} logged · ${String(totalShots)} shots recorded`
        }
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/sessions/new">
              <Plus aria-hidden="true" />
              Log a session
            </Link>
          </Button>
        }
      />

      {!loading && sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          body="Every chronograph string you log sharpens your own velocity and, once you choose to contribute, the Field Database behind it."
          action={
            <Button asChild variant="primary">
              <Link href="/sessions/new">
                <Plus aria-hidden="true" />
                Log your first session
              </Link>
            </Button>
          }
        />
      ) : null}

      <ul className="space-y-3">
        {sessions.map((session) => {
          const velocities = session.strings.flatMap((string) => string.velocitiesFps);
          const summary = velocities.length > 0 ? summarize(velocities) : null;
          const rifle = rifles.find((entry) => entry.id === session.rifleId);
          const load = loads.find((entry) => entry.id === session.loadId);

          return (
            <li key={session.id}>
              <Link
                href={`/sessions/${session.id}`}
                className="flex items-center gap-3 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-4 py-3 transition-colors hover:border-forge-600 hover:bg-gunmetal-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-100">
                    {rifle?.name ?? 'Unknown rifle'}
                    <span className="font-normal text-ink-500">
                      {' '}
                      · {load?.name ?? 'unknown load'}
                    </span>
                  </span>
                  <span className="num block truncate text-xs text-ink-500">
                    {session.occurredOn}
                    {summary === null
                      ? ' · no shots'
                      : ` · ${String(summary.n)} shots · ${summary.mean.toFixed(0)} fps · SD ${summary.sd === null ? '—' : summary.sd.toFixed(1)}`}
                  </span>
                </span>
                {session.status === 'draft' ? (
                  <Badge tone="warn" className="shrink-0">
                    Draft
                  </Badge>
                ) : null}
                {session.suppressorId === undefined ? null : (
                  <Badge tone="forge" className="shrink-0">
                    Suppressed
                  </Badge>
                )}
                <ChevronRight className="size-4 shrink-0 text-ink-700" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
