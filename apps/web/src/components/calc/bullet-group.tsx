'use client';

import type { ReactElement } from 'react';
import type { GroupProps } from './group-props';
import { Badge } from '@/components/ui/badge';
import { NumberField, OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { UNIT_LABEL } from '@/lib/calc/format';
import { messageFor } from '@/lib/calc/issues';

export function BulletGroup({ form, set, setUnits, issues }: GroupProps): ReactElement {
  const { units } = form;

  return (
    <Section
      title="Bullet / Load"
      summary={`${form.weight} ${UNIT_LABEL[units.mass]} · ${form.bcType} ${form.bcValue} · ${form.muzzleVelocity} ${UNIT_LABEL[units.velocity]}`}
      action={
        form.dataUnverified ? (
          <Badge
            tone="warn"
            title="These numbers have not been checked against the manufacturer's spec sheet."
          >
            Unverified
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="bullet-name">Bullet</Label>
          <Input
            id="bullet-name"
            className="font-sans"
            value={form.bulletName}
            autoComplete="off"
            onChange={(event) => {
              set('bulletName', event.target.value);
            }}
          />
          <p className="text-xs text-ink-700">
            The library browser arrives in Phase 7 — type any bullet for now.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <NumberField
            label="Weight"
            className="flex-1"
            value={form.weight}
            onChange={(value) => {
              set('weight', value);
            }}
            suffix={UNIT_LABEL[units.mass]}
            error={messageFor(issues, 'weight')}
          />
          <Segmented
            ariaLabel="Mass unit"
            size="sm"
            className="mb-1"
            value={units.mass}
            onChange={(mass) => {
              setUnits({ mass });
            }}
            options={[
              { value: 'gr', label: 'gr' },
              { value: 'g', label: 'g' },
            ]}
          />
        </div>

        <div className="flex items-end gap-2">
          <NumberField
            label="Diameter"
            className="flex-1"
            value={form.diameter}
            onChange={(value) => {
              set('diameter', value);
            }}
            suffix={UNIT_LABEL[units.smallLength]}
            error={messageFor(issues, 'diameter')}
          />
          <Segmented
            ariaLabel="Small length unit"
            size="sm"
            className="mb-1"
            value={units.smallLength}
            onChange={(smallLength) => {
              setUnits({ smallLength });
            }}
            options={[
              { value: 'in', label: 'in' },
              { value: 'mm', label: 'mm' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Drag function</Label>
          <Segmented
            ariaLabel="Drag function"
            className="w-full [&>button]:flex-1"
            value={form.bcType}
            onChange={(bcType) => {
              set('bcType', bcType);
            }}
            options={[
              { value: 'G1', label: 'G1', title: 'Flat-base reference projectile' },
              {
                value: 'G7',
                label: 'G7',
                title: 'Boat-tail reference projectile — better for modern match bullets',
              },
            ]}
          />
          <p className="text-xs text-ink-700">
            Use the BC published for the function you pick. They are not interchangeable.
          </p>
        </div>

        <NumberField
          label={`Ballistic coefficient (${form.bcType})`}
          value={form.bcValue}
          onChange={(value) => {
            set('bcValue', value);
          }}
          step={0.001}
          error={messageFor(issues, 'bcValue')}
        />

        <div className="flex items-end gap-2">
          <NumberField
            label="Muzzle velocity"
            className="flex-1"
            value={form.muzzleVelocity}
            onChange={(value) => {
              set('muzzleVelocity', value);
            }}
            suffix={UNIT_LABEL[units.velocity]}
            error={messageFor(issues, 'muzzleVelocity')}
            help="Chronographed from your rifle beats the box number."
          />
          <Segmented
            ariaLabel="Velocity unit"
            size="sm"
            className="mb-1"
            value={units.velocity}
            onChange={(velocity) => {
              setUnits({ velocity });
            }}
            options={[
              { value: 'fps', label: 'fps' },
              { value: 'mps', label: 'm/s' },
            ]}
          />
        </div>

        <OptionalNumberField
          label="Bullet length"
          value={form.bulletLength}
          onChange={(value) => {
            set('bulletLength', value);
          }}
          suffix={UNIT_LABEL[units.smallLength]}
          error={messageFor(issues, 'bulletLength')}
          emptyHelp="Unknown — spin drift and stability will be unavailable."
          help="Used for Miller stability and spin drift."
        />
      </div>
    </Section>
  );
}
