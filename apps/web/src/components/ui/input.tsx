import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({
  className,
  type = 'text',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return (
    <input
      type={type}
      className={cn(
        'num min-h-11 w-full rounded-md border border-gunmetal-700 bg-gunmetal-950 px-3 py-2',
        'text-base text-ink-100 placeholder:text-ink-500',
        'focus:border-forge-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-fail-500',
        className,
      )}
      {...props}
    />
  );
}
