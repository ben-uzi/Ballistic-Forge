import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-card border border-gunmetal-700 bg-gunmetal-850/60 shadow-sm shadow-black/20',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('border-b border-gunmetal-700 px-4 py-3', className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return (
    <h2
      className={cn('text-sm font-semibold uppercase tracking-wide text-ink-300', className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('px-4 py-4', className)} {...props} />;
}
