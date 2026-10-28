'use client';

import type { FitCheck, FitResult, FitStatus } from '@bf/engine';
import { AlertTriangle, CircleHelp, ShieldAlert, X, Check } from 'lucide-react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * Rendering a compatibility verdict.
 *
 * `unknown` is given its own visual weight rather than being folded in with
 * `warn`: the whole design of the checker is that missing data is not a mild
 * concern, it is an absence of information, and the UI has to say so.
 */

const STATUS: Readonly<Record<FitStatus, { label: string; classes: string; icon: typeof Check }>> =
  {
    pass: {
      label: 'Compatible',
      classes: 'border-pass-500/40 bg-pass-500/10 text-pass-500',
      icon: Check,
    },
    warn: {
      label: 'Check first',
      classes: 'border-warn-500/40 bg-warn-500/10 text-warn-500',
      icon: AlertTriangle,
    },
    unknown: {
      label: 'Not enough data',
      classes: 'border-gunmetal-600 bg-gunmetal-800 text-ink-300',
      icon: CircleHelp,
    },
    fail: {
      label: 'Do not fire',
      classes: 'border-fail-500/40 bg-fail-500/10 text-fail-500',
      icon: X,
    },
  };

const HEADLINE: Readonly<Record<FitStatus, string>> = {
  pass: 'Everything we can check lines up.',
  warn: 'Everything is known, but something needs your attention.',
  unknown: 'Some of what matters is missing, so this is not a pass.',
  fail: 'At least one check failed outright.',
};

export function FitVerdict({ result }: { readonly result: FitResult }): ReactElement {
  const spec = STATUS[result.status];
  const Icon = spec.icon;

  return (
    <div className="space-y-3">
      <div className={cn('flex items-start gap-3 rounded-card border px-4 py-3', spec.classes)}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{spec.label}</p>
          <p className="mt-0.5 text-sm opacity-90">{HEADLINE[result.status]}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {result.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>

      <p className="flex items-start gap-2 rounded-card border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-xs text-ink-500">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn-500" aria-hidden="true" />
        <span>
          <strong className="text-ink-300">This is a data check, not an approval.</strong> It
          compares the figures you have entered against what the manufacturer published, and it has
          no way to judge chamber pressure, your specific barrel, or the condition of your
          equipment. A bullet that contacts a baffle destroys the suppressor and can injure you and
          anyone nearby. When anything here is unclear, ask the manufacturer before you fire.
        </span>
      </p>
    </div>
  );
}

function CheckRow({ check }: { readonly check: FitCheck }): ReactElement {
  const spec = STATUS[check.status];
  const Icon = spec.icon;
  return (
    <li className="flex items-start gap-3 rounded-card border border-gunmetal-700 bg-gunmetal-850/60 px-3 py-2.5">
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          check.status === 'pass'
            ? 'text-pass-500'
            : check.status === 'warn'
              ? 'text-warn-500'
              : check.status === 'fail'
                ? 'text-fail-500'
                : 'text-ink-500',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm text-ink-100">{check.summary}</p>
        {check.detail === undefined ? null : (
          <p className="mt-0.5 text-xs text-ink-500">{check.detail}</p>
        )}
      </div>
    </li>
  );
}
