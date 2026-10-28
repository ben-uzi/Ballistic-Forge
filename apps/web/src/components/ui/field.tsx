'use client';

import { useEffect, useId, useState, type ReactElement, type ReactNode } from 'react';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';

export interface FieldProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly help?: ReactNode;
  readonly error?: string | undefined;
  readonly suffix?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Label + control + unit suffix + help/error text. Every control gets a label. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  suffix,
  children,
  className,
}: FieldProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative flex items-center">
        {children}
        {suffix ? (
          <span className="pointer-events-none absolute right-3 text-xs text-ink-500">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-fail-500">{error}</p>
      ) : help ? (
        <p className="text-xs text-ink-500">{help}</p>
      ) : null}
    </div>
  );
}

export interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly suffix?: ReactNode;
  readonly help?: ReactNode;
  readonly error?: string | undefined;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly className?: string;
  readonly inputClassName?: string;
}

/**
 * A numeric input that keeps the raw text while it is being typed, so "2." and
 * "-" are not reformatted out from under the user mid-entry. The committed
 * numeric value only changes when the text parses.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  help,
  error,
  step,
  min,
  max,
  className,
  inputClassName,
}: NumberFieldProps): ReactElement {
  const id = useId();
  const [text, setText] = useState(() => String(value));

  // Resync when the value changes from outside (unit switch, preset, reset).
  useEffect(() => {
    setText((current) => (Number.parseFloat(current) === value ? current : String(value)));
  }, [value]);

  return (
    <Field
      label={label}
      htmlFor={id}
      {...(help === undefined ? {} : { help })}
      {...(error === undefined ? {} : { error })}
      {...(suffix === undefined ? {} : { suffix })}
      {...(className === undefined ? {} : { className })}
    >
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={error === undefined ? undefined : true}
        className={cn(suffix ? 'pr-12' : undefined, inputClassName)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = Number.parseFloat(next);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => {
          // Snap the text back to the committed value on exit.
          setText(String(value));
        }}
        {...(step === undefined ? {} : { step })}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
      />
    </Field>
  );
}

export interface OptionalNumberFieldProps extends Omit<NumberFieldProps, 'value' | 'onChange'> {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  /** What an empty field means, e.g. "Unknown — spin drift will be off". */
  readonly emptyHelp?: ReactNode;
}

/** A numeric input where empty genuinely means "unknown", not zero. */
export function OptionalNumberField({
  label,
  value,
  onChange,
  suffix,
  help,
  emptyHelp,
  error,
  step,
  min,
  max,
  className,
}: OptionalNumberFieldProps): ReactElement {
  const id = useId();
  const [text, setText] = useState(() => (value === null ? '' : String(value)));

  useEffect(() => {
    setText((current) => {
      if (value === null) return current.trim() === '' ? current : '';
      return Number.parseFloat(current) === value ? current : String(value);
    });
  }, [value]);

  const isEmpty = text.trim() === '';

  return (
    <Field
      label={label}
      htmlFor={id}
      help={isEmpty && emptyHelp !== undefined ? emptyHelp : help}
      {...(error === undefined ? {} : { error })}
      {...(suffix === undefined ? {} : { suffix })}
      {...(className === undefined ? {} : { className })}
    >
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Unknown"
        value={text}
        className={cn(suffix ? 'pr-12' : undefined)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === '') {
            onChange(null);
            return;
          }
          const parsed = Number.parseFloat(next);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => {
          setText(value === null ? '' : String(value));
        }}
        {...(step === undefined ? {} : { step })}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
      />
    </Field>
  );
}
