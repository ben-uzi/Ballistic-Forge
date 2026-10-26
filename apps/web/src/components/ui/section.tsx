'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps {
  readonly title: string;
  /** A short summary shown on the header when collapsed, e.g. "140 gr · G7 0.326". */
  readonly summary?: React.ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly action?: React.ReactNode;
}

/** A collapsible input group. Collapsed groups still show their key values. */
export function Section({
  title,
  summary,
  defaultOpen = true,
  children,
  className,
  action,
}: SectionProps): React.ReactElement {
  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className={cn(
        'rounded-card border border-gunmetal-700 bg-gunmetal-850/60 overflow-hidden',
        className,
      )}
    >
      <div className="flex items-stretch">
        <Collapsible.Trigger
          className={cn(
            'group flex min-h-12 flex-1 items-center justify-between gap-3 px-4 text-left',
            'hover:bg-gunmetal-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
          )}
        >
          <span className="flex min-w-0 flex-col py-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-ink-300">
              {title}
            </span>
            {summary ? <span className="num truncate text-xs text-ink-500">{summary}</span> : null}
          </span>
          <ChevronDown className="size-5 shrink-0 text-ink-500 transition-transform group-data-[state=open]:rotate-180" />
        </Collapsible.Trigger>
        {action ? <div className="flex items-center pr-3">{action}</div> : null}
      </div>
      <Collapsible.Content>
        <div className="border-t border-gunmetal-700 px-4 py-4">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
