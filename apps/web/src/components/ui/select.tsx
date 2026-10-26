'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SelectProps<T extends string> {
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly SelectOption<T>[];
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  id,
  ariaLabel,
  className,
  disabled,
}: SelectProps<T>): React.ReactElement {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        onValueChange(next as T);
      }}
      disabled={disabled ?? false}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-md border border-gunmetal-700',
          'bg-gunmetal-950 px-3 py-2 text-left text-sm text-ink-100',
          'focus:border-forge-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-forge-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-ink-500" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-md border border-gunmetal-700 bg-gunmetal-850 shadow-lg shadow-black/50',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative flex min-h-10 cursor-pointer select-none items-center rounded px-2 pr-8 text-sm',
                  'text-ink-100 outline-none data-[highlighted]:bg-gunmetal-700',
                  'data-[state=checked]:text-forge-500',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
