import { ArrowRight, Crosshair, Database, Volume2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { WaitlistForm } from '@/components/shell/waitlist-form';

const PILLARS = [
  {
    icon: Crosshair,
    name: 'The Lab',
    status: 'Working now',
    ready: true,
    body: 'A point-mass G1/G7 solver with humid-air density, station-vs-barometric pressure, wind by the clock, true incline, Miller stability, spin drift and Coriolis. Any bullet from any manufacturer — there is no brand funnel here.',
  },
  {
    icon: Volume2,
    name: 'The Can',
    status: 'Working now',
    ready: true,
    body: 'Suppressed and unsuppressed as one profile: your own measured velocity delta and point-of-impact shift, plus a mount and calibre compatibility checker that answers "unknown" rather than guessing.',
  },
  {
    icon: Database,
    name: 'The Field',
    status: 'Logging now',
    ready: true,
    body: 'Log a chronograph string, an observed drop, a suppressor on and off. Your own history is yours from day one; the community aggregate stays switched off — enforced in the database, not just the interface — until enough shooters agree for the number to mean something.',
  },
] as const;

export default function HomePage(): ReactElement {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <section className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forge-500">
          Built in the Lab. Proven in the Field.
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink-100 sm:text-5xl">
          Precision ballistics that shows its working.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-300">
          A solver for hunters, long-range shooters and suppressor owners. Real atmospherics, honest
          uncertainty, and no manufacturer trying to sell you a bullet at the end of it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href="/calc">
              Open the calculator
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/onboarding">Set up my rifle</Link>
          </Button>
          <span className="text-xs text-ink-500">No account needed.</span>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3" aria-label="The three pillars">
        {PILLARS.map((pillar) => (
          <Card key={pillar.name} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-3">
              <div className="flex items-center justify-between">
                <pillar.icon className="size-5 text-forge-500" aria-hidden="true" />
                <span
                  className={
                    pillar.ready
                      ? 'rounded-full border border-pass-500/40 bg-pass-500/10 px-2 py-0.5 text-[0.625rem] uppercase tracking-wide text-pass-500'
                      : 'rounded-full border border-gunmetal-700 px-2 py-0.5 text-[0.625rem] uppercase tracking-wide text-ink-500'
                  }
                >
                  {pillar.status}
                </span>
              </div>
              <h2 className="text-base font-semibold text-ink-100">{pillar.name}</h2>
              <p className="text-sm leading-relaxed text-ink-500">{pillar.body}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <section className="mt-14 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 p-5">
        <h2 className="text-lg font-semibold text-ink-100">The pilot is small on purpose</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          There are no download counts or accuracy claims on this page because there is nothing yet
          to count. What exists is a solver you can check against your own DOPE, a suppressor
          checker that says &ldquo;unknown&rdquo; rather than guessing, and a test suite that runs
          on every commit. If that is interesting, say so.
        </p>
        <div className="mt-5 max-w-xl">
          <WaitlistForm />
        </div>
      </section>
    </div>
  );
}
