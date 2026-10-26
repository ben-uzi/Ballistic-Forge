'use client';

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly title?: string;
}

export interface SegmentedProps<T extends string> {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
  readonly ariaLabel: string;
  readonly className?: string;
  readonly size?: 'sm' | 'default';
}

/** A compact two-or-three-way choice: unit pairs, pressure type, rounding. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = 'default',
}: SegmentedProps<T>): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 rounded-md border border-gunmetal-700 bg-gunmetal-950 p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title ?? option.label}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'rounded px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
              size === 'sm' ? 'min-h-8 text-xs' : 'min-h-10 text-sm',
              selected ? 'bg-gunmetal-700 text-forge-500' : 'text-ink-500 hover:text-ink-300',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
