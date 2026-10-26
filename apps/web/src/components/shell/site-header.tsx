'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { LogoMark, Wordmark } from './logo';
import { NAV_ITEMS } from './nav-items';
import { Badge } from '@/components/ui/badge';
import { appMode } from '@/lib/env';
import { cn } from '@/lib/utils';

export function SiteHeader(): ReactElement {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-gunmetal-700 bg-gunmetal-900/95 backdrop-blur supports-[backdrop-filter]:bg-gunmetal-900/80">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500"
        >
          <LogoMark />
          <Wordmark className="hidden sm:inline" />
        </Link>

        <nav
          aria-label="Main"
          className="scroll-slim ml-auto flex items-center gap-1 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center whitespace-nowrap rounded px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
                  pathname.startsWith(item.href)
                    ? 'bg-gunmetal-800 text-forge-500'
                    : 'text-ink-300 hover:bg-gunmetal-800 hover:text-ink-100',
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                aria-disabled="true"
                title={`${item.label} is not built yet`}
                className="flex min-h-11 cursor-not-allowed items-center gap-1.5 whitespace-nowrap px-3 text-sm text-ink-700"
              >
                {item.label}
                <span className="rounded border border-gunmetal-700 px-1 text-[0.625rem] uppercase">
                  soon
                </span>
              </span>
            ),
          )}
        </nav>

        {appMode === 'demo' ? (
          <Badge
            tone="warn"
            className="hidden shrink-0 md:inline-flex"
            title="No backend is configured: profiles are stored in this browser only."
          >
            Demo mode
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
