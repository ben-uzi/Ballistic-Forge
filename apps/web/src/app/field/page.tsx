'use client';

import { summarize } from '@bf/engine';
import { Database, Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { SERIES_COLORS } from '@/components/calc/charts';
import { DEFAULT_FLAGS } from '@/lib/flags';
import { useLoads, useRifles, useSessions } from '@/lib/store/hooks';

/**
 * The Field.
 *
 * Your own history is always yours. The community view stays behind
 * `field_data_public` until there is enough data for an aggregate to mean
 * anything, and this page says so plainly rather than showing an empty
 * community panel that looks broken.
 */
export default function FieldPage(): ReactElement {
  const { data: sessions, loading } = useSessions();
  const { data: rifles } = useRifles();
  const { data: loads } = useLoads();

  const shots = sessions.reduce(
    (total, session) =>
      total + session.strings.reduce((sum, string) => sum + string.velocitiesFps.length, 0),
    0,
  );

  const history = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.strings.some((string) => string.velocitiesFps.length > 0))
        .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
        .map((session) => {
          const velocities = session.strings.flatMap((string) => string.velocitiesFps);
          const summary = summarize(velocities);
          return {
            date: session.occurredOn,
            mean: Math.round(summary.mean),
            sd: summary.sd === null ? null : Math.round(summary.sd * 10) / 10,
            tempF: session.tempF ?? null,
            loadName: loads.find((load) => load.id === session.loadId)?.name ?? 'unknown',
          };
        }),
    [sessions, loads],
  );

  const byLoad = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const session of sessions) {
      const velocities = session.strings.flatMap((string) => string.velocitiesFps);
      if (velocities.length === 0) continue;
      const name = loads.find((load) => load.id === session.loadId)?.name ?? 'Unknown load';
      groups.set(name, [...(groups.get(name) ?? []), ...velocities]);
    }
    return [...groups.entries()].map(([name, velocities]) => ({
      name,
      summary: summarize(velocities),
    }));
  }, [sessions, loads]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="The Field"
        subtitle="Your shot data, and the community picture it will eventually build"
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/sessions/new">
              <Plus aria-hidden="true" />
              Log a session
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-4 rounded-card border border-forge-600/40 bg-forge-500/5 px-5 py-4">
        <Database className="size-6 shrink-0 text-forge-500" aria-hidden="true" />
        <div>
          <p className="num text-2xl font-bold text-ink-100">{String(shots)}</p>
          <p className="text-sm text-ink-500">
            {shots === 1 ? 'shot' : 'shots'} logged across {String(sessions.length)}{' '}
            {sessions.length === 1 ? 'session' : 'sessions'} and {String(rifles.length)}{' '}
            {rifles.length === 1 ? 'rifle' : 'rifles'}
          </p>
        </div>
      </div>

      {!loading && sessions.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          body="Your velocity history, spread over time, and how temperature moves it — all of it comes from sessions you log."
          action={
            <Button asChild variant="primary">
              <Link href="/sessions/new">Log your first session</Link>
            </Button>
          }
        />
      ) : null}

      {history.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Muzzle velocity over time</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#292944" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#5C5C70', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#292944' }}
                  />
                  <YAxis
                    tick={{ fill: '#5C5C70', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    domain={['dataMin - 20', 'dataMax + 20']}
                  />
                  <Tooltip
                    cursor={{ stroke: '#5C5C70', strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: '#14141F',
                      border: '1px solid #363654',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#8B8B9E' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    name="Mean fps"
                    stroke={SERIES_COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-700">
              One point per session. A drift downwards over a season is usually throat erosion or
              the weather, not the ammunition.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {byLoad.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>By load</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full border-collapse text-right text-sm">
                <thead className="text-[0.6875rem] uppercase tracking-wide text-ink-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Load
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Shots
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Mean
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      SD
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      ES
                    </th>
                  </tr>
                </thead>
                <tbody className="num">
                  {byLoad.map((entry) => (
                    <tr key={entry.name} className="border-t border-gunmetal-800">
                      <td className="px-3 py-2 text-left text-ink-100">{entry.name}</td>
                      <td className="px-3 py-2 text-ink-300">{entry.summary.n}</td>
                      <td className="px-3 py-2 text-forge-500">{entry.summary.mean.toFixed(0)}</td>
                      <td className="px-3 py-2 text-ink-300">
                        {entry.summary.sd === null ? '—' : entry.summary.sd.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-ink-300">{entry.summary.es.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Lock className="size-4 text-ink-500" aria-hidden="true" />
          <CardTitle>Community data</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-ink-500">
          <p>
            Aggregated velocities across every contributor are switched off. They stay off until
            there is enough data behind them to be worth reading — the threshold is{' '}
            <span className="num text-ink-300">
              {DEFAULT_FLAGS.fieldRevealThresholdShots.toLocaleString('en-US')}
            </span>{' '}
            logged shots, and a group is only ever shown once at least{' '}
            <span className="num text-ink-300">{String(DEFAULT_FLAGS.minSessionsToDisplay)}</span>{' '}
            sessions from{' '}
            <span className="num text-ink-300">{String(DEFAULT_FLAGS.minUsersToDisplay)}</span>{' '}
            different shooters agree.
          </p>
          <p>
            That rule is enforced in the database, not just in this page, so it cannot be revealed
            early by a bug in the interface.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
