'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>): React.ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-xs font-medium uppercase tracking-wide text-ink-500 select-none',
        className,
      )}
      {...props}
    />
  );
}
