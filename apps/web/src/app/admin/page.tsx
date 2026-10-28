import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { DEFAULT_FLAGS } from '@/lib/flags';
import { hasSupabase } from '@/lib/env';
import { adminEmails, getServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin' };

/**
 * The admin view.
 *
 * A **server component on purpose**. The guard has to run where the user cannot
 * reach it: a client-side `isAdmin` check is decoration, and row-level security
 * would stop the queries anyway. In demo mode there is no session to check, so
 * rather than render a fake console this says what is missing.
 */
export default async function AdminPage(): Promise<ReactElement> {
  if (!hasSupabase) {
    return (
      <Shell>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warn-500" aria-hidden="true" />
            <CardTitle>Not available in demo mode</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-ink-500">
            <p>
              Administration needs a backend: there is no account to authenticate, no reference data
              to review and no aggregate to inspect while everything lives in your browser.
            </p>
            <p>
              Connect a Supabase project and set{' '}
              <code className="num text-ink-300">ADMIN_EMAILS</code> and this becomes the review
              queue, the flag switchboard and the progress counter towards the Field reveal.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/field">Back to The Field</Link>
            </Button>
          </CardBody>
        </Card>

        <FlagTable />
      </Shell>
    );
  }

  const supabase = await getServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const email = data.user?.email?.toLowerCase();
  const allowed = email !== undefined && adminEmails().includes(email);

  if (!allowed) {
    return (
      <Shell>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-fail-500" aria-hidden="true" />
            <CardTitle>Not your page</CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-ink-500">
            This area is restricted to administrators.
          </CardBody>
        </Card>
      </Shell>
    );
  }

  const [shots, sessions, users, pending] = await Promise.all([
    supabase?.from('shot_strings').select('velocities_fps'),
    supabase?.from('sessions').select('id', { count: 'exact', head: true }),
    supabase?.from('profiles').select('user_id', { count: 'exact', head: true }),
    supabase?.from('corrections').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const shotCount = (shots?.data ?? []).reduce(
    (total, row) => total + ((row.velocities_fps as number[] | null) ?? []).length,
    0,
  );
  const threshold = DEFAULT_FLAGS.fieldRevealThresholdShots;

  return (
    <Shell>
      <dl className="num grid grid-cols-2 gap-px overflow-hidden rounded-card border border-gunmetal-700 bg-gunmetal-700 sm:grid-cols-4">
        <Stat label="Shots logged" value={shotCount.toLocaleString('en-US')} />
        <Stat label="Sessions" value={String(sessions?.count ?? 0)} />
        <Stat label="Accounts" value={String(users?.count ?? 0)} />
        <Stat label="Open corrections" value={String(pending?.count ?? 0)} />
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Progress to the Field reveal</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-gunmetal-800">
            <div
              className="h-full bg-forge-500"
              style={{ width: `${String(Math.min(100, (shotCount / threshold) * 100))}%` }}
            />
          </div>
          <p className="num text-sm text-ink-500">
            {shotCount.toLocaleString('en-US')} of {threshold.toLocaleString('en-US')} shots
          </p>
        </CardBody>
      </Card>

      <FlagTable />
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader title="Admin" subtitle="Reference data, flags and Field progress" />
      {children}
    </div>
  );
}

function FlagTable(): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="space-y-2 text-sm">
          {Object.entries(DEFAULT_FLAGS).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <dt className="num text-ink-300">{key}</dt>
              <dd className="num text-ink-500">{String(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-gunmetal-700 pt-3 text-xs text-ink-700">
          These are the compile-time defaults. Once a database is connected the{' '}
          <code>app_flags</code> table is the source of truth, and the reveal gate is enforced by
          row-level security rather than by this page.
        </p>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div className="bg-gunmetal-850 px-3 py-3">
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-700">{label}</dt>
      <dd className="mt-0.5 text-lg text-ink-100">{value}</dd>
    </div>
  );
}
