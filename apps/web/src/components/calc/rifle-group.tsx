'use client';

import type { ReactElement } from 'react';
import type { GroupProps } from './group-props';
import { NumberField, OptionalNumberField } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { UNIT_LABEL } from '@/lib/calc/format';
import { messageFor } from '@/lib/calc/issues';
import type { ClickKey } from '@/lib/calc/types';

const CLICK_OPTIONS: readonly { value: ClickKey; label: string }[] = [
  { value: 'mil_0_1', label: '0.1 mil' },
  { value: 'moa_0_25', label: '1/4 MOA' },
  { value: 'moa_0_125', label: '1/8 MOA' },
];

export function RifleGroup({ form, set, setUnits, issues }: GroupProps): ReactElement {
  const { units } = form;

  return (
    <Section
      title="Rifle"
      summary={`${form.sightHeight} ${UNIT_LABEL[units.smallLength]} sight · ${form.zeroRange} ${UNIT_LABEL[units.range]} zero · ${UNIT_LABEL[units.angular]}`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Sight height"
          value={form.sightHeight}
          onChange={(value) => {
            set('sightHeight', value);
          }}
          suffix={UNIT_LABEL[units.smallLength]}
          error={messageFor(issues, 'sightHeight')}
          help="Bore centreline to scope centreline."
        />

        <div className="flex items-end gap-2">
          <NumberField
            label="Zero range"
            className="flex-1"
            value={form.zeroRange}
            onChange={(value) => {
              set('zeroRange', value);
            }}
            suffix={UNIT_LABEL[units.range]}
            error={messageFor(issues, 'zeroRange')}
          />
          <Segmented
            ariaLabel="Range unit"
            size="sm"
            className="mb-1"
            value={units.range}
            onChange={(range) => {
              setUnits({ range });
            }}
            options={[
              { value: 'yd', label: 'yd' },
              { value: 'm', label: 'm' },
            ]}
          />
        </div>

        <OptionalNumberField
          label="Twist rate (1 turn in)"
          value={form.twist}
          onChange={(value) => {
            set('twist', value);
          }}
          suffix={UNIT_LABEL[units.smallLength]}
          error={messageFor(issues, 'twist')}
          emptyHelp="Unknown — spin drift and stability will be unavailable."
        />

        <div className="flex flex-col gap-1.5">
          <Label>Twist direction</Label>
          <Segmented
            ariaLabel="Twist direction"
            className="w-full [&>button]:flex-1"
            value={form.twistDirection}
            onChange={(twistDirection) => {
              set('twistDirection', twistDirection);
            }}
            options={[
              { value: 'right', label: 'Right' },
              { value: 'left', label: 'Left' },
            ]}
          />
          <p className="text-xs text-ink-500">
            Right-hand twist drifts the bullet right at distance.
          </p>
        </div>

        <NumberField
          label="Zero offset (impact high)"
          value={form.zeroOffset}
          onChange={(value) => {
            set('zeroOffset', value);
          }}
          suffix={UNIT_LABEL[units.smallLength]}
          error={messageFor(issues, 'zeroOffset')}
          help="Where your group actually landed at the zero range. Positive is high."
        />

        <div className="flex flex-col gap-1.5">
          <Label>Turret unit</Label>
          <Segmented
            ariaLabel="Turret unit"
            className="w-full [&>button]:flex-1"
            value={units.angular}
            onChange={(angular) => {
              setUnits({ angular });
            }}
            options={[
              { value: 'mil', label: 'MIL' },
              { value: 'moa', label: 'MOA', title: 'True MOA — 1/60 of a degree' },
              { value: 'iphy', label: 'IPHY', title: "Shooter's MOA — exactly 1 inch per 100 yd" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="elevation-click">Elevation click</Label>
          <Select
            id="elevation-click"
            value={form.elevationClickKey}
            onValueChange={(value) => {
              set('elevationClickKey', value);
            }}
            options={CLICK_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="windage-click">Windage click</Label>
          <Select
            id="windage-click"
            value={form.windageClickKey}
            onValueChange={(value) => {
              set('windageClickKey', value);
            }}
            options={CLICK_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Click rounding</Label>
          <Segmented
            ariaLabel="Click rounding"
            className="w-full [&>button]:flex-1"
            value={form.rounding}
            onChange={(rounding) => {
              set('rounding', rounding);
            }}
            options={[
              { value: 'nearest', label: 'Nearest' },
              { value: 'down', label: 'Down', title: 'Never dial past the solution' },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}
