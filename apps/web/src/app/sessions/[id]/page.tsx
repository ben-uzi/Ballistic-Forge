'use client';

import { aggregateSessions, type SessionSample } from '@bf/db/aggregate';
import { summarize } from '@bf/engine';
import { Info, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { getStore } from '@/lib/store';
import { useLoads, useRifles, useSession, useSuppressors } from '@/lib/store/hooks';
import type { StoredLoad, StoredRifle, StoredSession } from '@/lib/store/types';

export default function SessionDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: session, loading } = useSession(params.id);
  const { data: rifles } = useRifles();
  const { data: loads } = useLoads();
  const { data: suppressors } = useSuppressors();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rifle = rifles.find((entry) => entry.id === session?.rifleId) ?? null;
  const load = loads.find((entry) => entry.id === session?.loadId) ?? null;

  /*
   * Run this one session through the real aggregation pipeline.
   *
   * It will never clear the disclosure thresholds on its own, but the exclusion
   * reasons are exactly what the server would produce — so the owner can see
   * why their session would or would not count, instead of guessing.
   */
  const verdict = useMemo(() => {
    if (session === null || rifle === null || load === null) return null;
    return aggregateSessions([toSample(session, rifle, load)]);
  }, [session, rifle, load]);

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (session === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="No such session"
          body="It may have been deleted, or saved in a different browser."
          action={
            <Button asChild variant="primary">
              <Link href="/sessions">Back to sessions</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const velocities = session.strings.flatMap((string) => string.velocitiesFps);
  const overall = velocities.length > 0 ? summarize(velocities) : null;
  const can = suppressors.find((entry) => entry.id === session.suppressorId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href="/sessions" className="hover:text-ink-300">
          Sessions
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">{session.occurredOn}</span>
      </nav>

      <PageHeader
        title={rifle?.name ?? 'Session'}
        subtitle={`${session.occurredOn} · ${load?.name ?? 'unknown load'}${can === undefined ? '' : ` · ${can.name}`}`}
      />

      {overall === null ? null : (
        <dl className="num grid grid-cols-4 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 text-center">
          <Stat label="Shots" value={String(overall.n)} />
          <Stat label="Mean" value={`${overall.mean.toFixed(0)} fps`} />
          <Stat label="SD" value={overall.sd === null ? '—' : overall.sd.toFixed(1)} />
          <Stat label="ES" value={overall.es.toFixed(0)} />
        </dl>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Strings</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {session.strings.map((string, index) => {
            const summary =
              string.velocitiesFps.length > 0 ? summarize(string.velocitiesFps) : null;
            return (
              <div key={string.id} className="rounded-card border border-gunmetal-700 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-ink-100">
                    String {index + 1}
                    {string.suppressed ? <Badge tone="forge">Suppressed</Badge> : null}
                    {string.firstRoundCold ? <Badge tone="neutral">Cold bore</Badge> : null}
                  </span>
                  <span className="num text-xs text-ink-500">
                    {summary === null
                      ? 'no shots'
                      : `${String(summary.n)} · ${summary.mean.toFixed(0)} fps · SD ${summary.sd === null ? '—' : summary.sd.toFixed(1)}`}
                  </span>
                </div>
                {string.velocitiesFps.length === 0 ? null : (
                  <p className="num mt-1 text-xs text-ink-500">
                    {string.velocitiesFps.join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Spec label="Chronograph" value={session.chronoType.replace(/_/g, ' ')} />
            <Spec
              label="Temperature"
              value={session.tempF === undefined ? undefined : `${String(session.tempF)} °F`}
            />
            <Spec
              label="Altitude"
              value={
                session.altitudeFt === undefined ? undefined : `${String(session.altitudeFt)} ft`
              }
            />
            <Spec
              label="Humidity"
              value={
                session.humidityPct === undefined ? undefined : `${String(session.humidityPct)}%`
              }
            />
            <Spec label="Region" value={session.regionCoarse} />
            <Spec
              label="POI shift"
              value={
                session.poiVerticalIn === undefined && session.poiHorizontalIn === undefined
                  ? undefined
                  : `${String(session.poiVerticalIn ?? 0)} in up, ${String(session.poiHorizontalIn ?? 0)} in right`
              }
            />
          </dl>
          {session.notes === undefined ? null : (
            <p className="mt-4 border-t border-gunmetal-700 pt-3 text-sm text-ink-300">
              {session.notes}
            </p>
          )}
        </CardBody>
      </Card>

      {verdict === null ? null : (
        <Card>
          <CardHeader>
            <CardTitle>In the Field Database</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {verdict.excluded.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-ink-300">
                <Info className="mt-0.5 size-4 shrink-0 text-pass-500" aria-hidden="true" />
                This session passes every check and would count towards the community aggregate for
                its load and barrel length.
              </p>
            ) : (
              verdict.excluded.map((exclusion) => (
                <p
                  key={exclusion.reason}
                  className="flex items-start gap-2 rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-sm text-warn-500"
                >
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {exclusion.message}
                </p>
              ))
            )}
            <p className="text-xs text-ink-500">
              Community aggregates are not published yet. Your own history always shows everything
              you logged, whether or not it counts towards one.
            </p>
          </CardBody>
        </Card>
      )}

      <section className="border-t border-gunmetal-700 pt-5">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3">
            <p className="flex-1 text-sm text-fail-500">
              Delete this session? This cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                void getStore()
                  .deleteSession(session.id)
                  .then(() => {
                    router.push('/sessions');
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
            Delete this session
          </Button>
        )}
      </section>
    </div>
  );
}

/** Map a locally stored session onto the aggregation pipeline's input shape. */
export function toSample(
  session: StoredSession,
  rifle: StoredRifle,
  load: StoredLoad,
): SessionSample {
  return {
    sessionId: session.id,
    // Guest mode has no account; aggregation still runs so the owner can see
    // which checks their session passes.
    userId: 'local',
    userFlagged: false,
    contributionOptIn: true,
    occurredOn: session.occurredOn,
    bulletId: load.bullet.name,
    factoryLoadId: null,
    barrelLengthIn: rifle.barrelLengthIn ?? null,
    suppressorId: session.suppressorId ?? null,
    chronoType: session.chronoType,
    tempF: session.tempF ?? null,
    tempSensitivityFpsPerF: load.temperatureSensitivityFpsPerF ?? null,
    advertisedMvFps: load.muzzleVelocityFps,
    strings: session.strings.map((string) => ({
      suppressed: string.suppressed,
      velocitiesFps: string.velocitiesFps,
    })),
  };
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div className="bg-gunmetal-850 px-2 py-2">
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-100">{value}</dd>
    </div>
  );
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
        {value === undefined ? <span className="text-ink-500">not recorded</span> : value}
      </dd>
    </div>
  );
}
