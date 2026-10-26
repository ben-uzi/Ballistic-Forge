import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * PLACEHOLDER mark (NEEDS_CHAD 5). Inlined rather than loaded from
 * /brand/logo.svg so it inherits currentColor and never flashes.
 */
export function LogoMark({ className }: { readonly className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-7 text-forge-500', className)}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
        <circle cx="24" cy="24" r="15.8" />
        <path d="M24 8.2v8.6M24 31.2v8.6M8.2 24h8.6M31.2 24h8.6" />
      </g>
      <path d="M24 19.2 28.8 24 24 28.8 19.2 24Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { readonly className?: string }): ReactElement {
  return (
    <span
      className={cn(
        'text-sm font-bold uppercase tracking-[0.18em] text-ink-100 whitespace-nowrap',
        className,
      )}
    >
      Ballistic<span className="text-forge-500"> Forge</span>
    </span>
  );
}
