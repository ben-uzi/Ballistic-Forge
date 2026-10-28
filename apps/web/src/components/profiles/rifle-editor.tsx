'use client';

import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { NumberField, OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import type { ClickKey } from '@/lib/calc/types';
import type { StoredRifle } from '@/lib/store/types';

const CLICK_OPTIONS: readonly { value: ClickKey; label: string }[] = [
  { value: 'mil_0_1', label: '0.1 mil' },
  { value: 'moa_0_25', label: '1/4 MOA' },
  { value: 'moa_0_125', label: '1/8 MOA' },
];

/**
 * Rifle profile form. Values are kept in US customary units, which is how they
 * are stored; the calculator converts when it loads the profile.
 *
 * There is no serial-number field, and there never will be (BUILD_BRIEF §13).
 */
export function RifleEditor({
  rifle,
  onSave,
  onCancel,
}: {
  readonly rifle: StoredRifle;
  readonly onSave: (rifle: StoredRifle) => void;
  readonly onCancel?: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(rifle);

  const set = <K extends keyof StoredRifle>(key: K, value: StoredRifle[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rifle-name">Name</Label>
          <Input
            id="rifle-name"
            className="font-sans"
            required
            value={draft.name}
            onChange={(event) => {
              set('name', event.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rifle-cartridge">Cartridge</Label>
          <Input
            id="rifle-cartridge"
            className="font-sans"
            placeholder="6.5 Creedmoor"
            value={draft.cartridge}
            onChange={(event) => {
              set('cartridge', event.target.value);
            }}
          />
        </div>

        <NumberField
          label="Sight height"
          suffix="in"
          value={draft.sightHeightIn}
          onChange={(value) => {
            set('sightHeightIn', value);
          }}
          help="Bore centreline to scope centreline."
        />

        <NumberField
          label="Zero range"
          suffix="yd"
          value={draft.zeroRangeYd}
          onChange={(value) => {
            set('zeroRangeYd', value);
          }}
        />

        <OptionalNumberField
          label="Barrel length"
          suffix="in"
          value={draft.barrelLengthIn ?? null}
          onChange={(value) => {
            set('barrelLengthIn', value ?? undefined);
          }}
          emptyHelp="Unknown. Field data groups by barrel length, so it is worth filling in."
        />

        <OptionalNumberField
          label="Twist rate (1 turn in)"
          suffix="in"
          value={draft.twistIn ?? null}
          onChange={(value) => {
            set('twistIn', value ?? undefined);
          }}
          emptyHelp="Unknown — spin drift and stability will be unavailable."
        />

        <div className="flex flex-col gap-1.5">
          <Label>Twist direction</Label>
          <Segmented
            ariaLabel="Twist direction"
            className="w-full [&>button]:flex-1"
            value={draft.twistDirection}
            onChange={(value) => {
              set('twistDirection', value);
            }}
            options={[
              { value: 'right', label: 'Right' },
              { value: 'left', label: 'Left' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Turret unit</Label>
          <Segmented
            ariaLabel="Turret unit"
            className="w-full [&>button]:flex-1"
            value={draft.angularUnit}
            onChange={(value) => {
              set('angularUnit', value);
            }}
            options={[
              { value: 'mil', label: 'MIL' },
              { value: 'moa', label: 'MOA' },
              { value: 'iphy', label: 'IPHY' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rifle-elev-click">Elevation click</Label>
          <Select
            id="rifle-elev-click"
            value={draft.elevationClickKey as ClickKey}
            onValueChange={(value) => {
              set('elevationClickKey', value);
            }}
            options={CLICK_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rifle-wind-click">Windage click</Label>
          <Select
            id="rifle-wind-click"
            value={draft.windageClickKey as ClickKey}
            onValueChange={(value) => {
              set('windageClickKey', value);
            }}
            options={CLICK_OPTIONS}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Save rifle
        </Button>
        {onCancel === undefined ? null : (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
