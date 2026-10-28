'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { SERIES_COLORS } from './charts';
import { Button } from '@/components/ui/button';
import { NumberField, OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { UNIT_LABEL } from '@/lib/calc/format';
import { MAX_COMPARE_LOADS, type CalcForm, type CompareLoad } from '@/lib/calc/types';

export interface ComparePanelProps {
  readonly form: CalcForm;
  readonly loads: readonly CompareLoad[];
  readonly onChange: (loads: readonly CompareLoad[]) => void;
}

/**
 * Compare mode: up to two extra loads overlaid on the primary one
 * (BUILD_BRIEF §6.2). They share the rifle, zero and conditions, so only what
 * differs between bullets is editable here.
 */
export function ComparePanel({ form, loads, onChange }: ComparePanelProps): ReactElement {
  const { units } = form;
  // Slot 0 belongs to the primary load, so the extras start at 1.
  const remaining = MAX_COMPARE_LOADS - 1 - loads.length;

  const add = (): void => {
    const slot = loads.length + 1;
    onChange([
      ...loads,
      {
        id: `cmp-${String(Date.now())}-${String(slot)}`,
        label: `Load ${String(slot + 1)}`,
        bcType: form.bcType,
        bcValue: form.bcValue,
        weight: form.weight,
        diameter: form.diameter,
        bulletLength: form.bulletLength,
        muzzleVelocity: form.muzzleVelocity,
      },
    ]);
  };

  const update = (id: string, patch: Partial<CompareLoad>): void => {
    onChange(loads.map((load) => (load.id === id ? { ...load, ...patch } : load)));
  };

  return (
    <Section
      title="Compare"
      defaultOpen={loads.length > 0}
      summary={
        loads.length === 0
          ? 'Overlay up to two more loads'
          : `${String(loads.length + 1)} loads overlaid`
      }
    >
      <div className="space-y-4">
        {loads.length === 0 ? (
          <p className="text-sm text-ink-500">
            Put a second or third bullet on the same charts — same rifle, same zero, same
            conditions. Useful for picking between cartridges honestly.
          </p>
        ) : null}

        {loads.map((load, index) => (
          <div
            key={load.id}
            className="space-y-4 rounded-card border border-gunmetal-700 bg-gunmetal-950/40 p-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`cmp-label-${load.id}`}>
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-0.5 w-4 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[index + 1] }}
                    />
                    Label
                  </span>
                </Label>
                <Input
                  id={`cmp-label-${load.id}`}
                  className="font-sans"
                  value={load.label}
                  onChange={(event) => {
                    update(load.id, { label: event.target.value });
                  }}
                />
              </div>
              <Button
                variant="danger"
                size="icon"
                aria-label={`Remove ${load.label}`}
                onClick={() => {
                  onChange(loads.filter((l) => l.id !== load.id));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Weight"
                value={load.weight}
                onChange={(value) => {
                  update(load.id, { weight: value });
                }}
                suffix={UNIT_LABEL[units.mass]}
              />
              <NumberField
                label="Diameter"
                value={load.diameter}
                onChange={(value) => {
                  update(load.id, { diameter: value });
                }}
                suffix={UNIT_LABEL[units.smallLength]}
              />
              <div className="flex flex-col gap-1.5">
                <Label>Drag function</Label>
                <Segmented
                  ariaLabel={`Drag function for ${load.label}`}
                  className="w-full [&>button]:flex-1"
                  value={load.bcType}
                  onChange={(bcType) => {
                    update(load.id, { bcType });
                  }}
                  options={[
                    { value: 'G1', label: 'G1' },
                    { value: 'G7', label: 'G7' },
                  ]}
                />
              </div>
              <NumberField
                label={`Ballistic coefficient (${load.bcType})`}
                value={load.bcValue}
                onChange={(value) => {
                  update(load.id, { bcValue: value });
                }}
                step={0.001}
              />
              <NumberField
                label="Muzzle velocity"
                value={load.muzzleVelocity}
                onChange={(value) => {
                  update(load.id, { muzzleVelocity: value });
                }}
                suffix={UNIT_LABEL[units.velocity]}
              />
              <OptionalNumberField
                label="Bullet length"
                value={load.bulletLength}
                onChange={(value) => {
                  update(load.id, { bulletLength: value });
                }}
                suffix={UNIT_LABEL[units.smallLength]}
                emptyHelp="Unknown — no spin drift for this load."
              />
            </div>
          </div>
        ))}

        {remaining > 0 ? (
          <Button variant="outline" onClick={add}>
            <Plus aria-hidden="true" />
            Add a load to compare
          </Button>
        ) : (
          <p className="text-xs text-ink-500">
            Three loads is the limit — beyond that the charts stop being readable.
          </p>
        )}
      </div>
    </Section>
  );
}
