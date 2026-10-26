'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        'scroll-slim flex gap-1 overflow-x-auto rounded-md border border-gunmetal-700 bg-gunmetal-950 p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.ReactElement {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'min-h-10 flex-1 whitespace-nowrap rounded px-3 text-sm font-medium text-ink-500 transition-colors',
        'hover:text-ink-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
        'data-[state=active]:bg-gunmetal-800 data-[state=active]:text-forge-500',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>): React.ReactElement {
  return <TabsPrimitive.Content className={cn('mt-3 outline-none', className)} {...props} />;
}
