import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium leading-tight',
  {
    variants: {
      tone: {
        neutral: 'border-gunmetal-700 bg-gunmetal-850 text-ink-300',
        pass: 'border-pass-500/40 bg-pass-500/10 text-pass-500',
        warn: 'border-warn-500/40 bg-warn-500/10 text-warn-500',
        fail: 'border-fail-500/40 bg-fail-500/10 text-fail-500',
        forge: 'border-forge-600 bg-forge-500/10 text-forge-500',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps): React.ReactElement {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
