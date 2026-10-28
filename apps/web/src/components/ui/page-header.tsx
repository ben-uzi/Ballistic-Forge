import type { ReactElement, ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
}): ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink-100">{title}</h1>
        {subtitle === undefined ? null : (
          <p className="num mt-0.5 text-sm text-ink-500">{subtitle}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <div className="rounded-card border border-dashed border-gunmetal-700 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{body}</p>
      {action === undefined ? null : <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
