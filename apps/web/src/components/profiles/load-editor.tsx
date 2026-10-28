'use client';

import { useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NumberField, OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import type { MuzzleVelocitySource, StoredLoad } from '@/lib/store/types';

const MV_SOURCES: readonly { value: MuzzleVelocitySource; label: string }[] = [
  { value: 'chronograph', label: 'Chronographed' },
  { value: 'advertised', label: 'Advertised (box)' },
  { value: 'trued', label: 'Trued' },
  { value: 'estimated', label: 'Estimated' },
];

/**
 * Load profile form.
 *
 * Deliberately absent: anything about powder or charge weight. The app takes a
 * muzzle velocity the shooter measured or read off a box and never discusses
 * how it was produced (BUILD_BRIEF §13).
 */
export function LoadEditor({
  load,
  onSave,
  onCancel,
}: {
  readonly load: StoredLoad;
  readonly onSave: (load: StoredLoad) => void;
  readonly onCancel?: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(load);

  const set = <K extends keyof StoredLoad>(key: K, value: StoredLoad[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setBullet = <K extends keyof StoredLoad['bullet']>(
    key: K,
    value: StoredLoad['bullet'][K],
  ): void => {
    setDraft((current) => ({ ...current, bullet: { ...current.bullet, [key]: value } }));
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
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="load-name">Load name</Label>
          <Input
            id="load-name"
            className="font-sans"
            required
            placeholder="Hornady Match 140 ELD-M"
            value={draft.name}
            onChange={(event) => {
              set('name', event.target.value);
            }}
          />
        </div>
      </div>

      <Section
        title="Bullet"
        summary={`${String(draft.bullet.weightGr)} gr · ${draft.bullet.bcType} ${String(draft.bullet.bcValue)}`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bullet-name">Bullet</Label>
            <Input
              id="bullet-name"
              className="font-sans"
              value={draft.bullet.name}
              onChange={(event) => {
                setBullet('name', event.target.value);
              }}
            />
          </div>

          <NumberField
            label="Weight"
            suffix="gr"
            value={draft.bullet.weightGr}
            onChange={(value) => {
              setBullet('weightGr', value);
            }}
          />
          <NumberField
            label="Diameter"
            suffix="in"
            value={draft.bullet.diameterIn}
            onChange={(value) => {
              setBullet('diameterIn', value);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <Label>Drag function</Label>
            <Segmented
              ariaLabel="Drag function"
              className="w-full [&>button]:flex-1"
              value={draft.bullet.bcType}
              onChange={(value) => {
                setBullet('bcType', value);
              }}
              options={[
                { value: 'G1', label: 'G1' },
                { value: 'G7', label: 'G7' },
              ]}
            />
          </div>

          <NumberField
            label={`Ballistic coefficient (${draft.bullet.bcType})`}
            step={0.001}
            value={draft.bullet.bcValue}
            onChange={(value) => {
              setBullet('bcValue', value);
            }}
          />

          <OptionalNumberField
            label="Bullet length"
            suffix="in"
            value={draft.bullet.lengthIn ?? null}
            onChange={(value) => {
              setBullet('lengthIn', value ?? undefined);
            }}
            emptyHelp="Unknown — spin drift and stability will be unavailable."
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bullet-source">Source URL</Label>
            <Input
              id="bullet-source"
              type="url"
              className="font-sans"
              placeholder="https://www.hornady.com/..."
              value={draft.bullet.sourceUrl ?? ''}
              onChange={(event) => {
                setBullet('sourceUrl', event.target.value === '' ? undefined : event.target.value);
              }}
            />
            <label className="flex items-center gap-2 text-xs text-ink-500">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-forge-500)]"
                checked={draft.bullet.verified}
                onChange={(event) => {
                  setBullet('verified', event.target.checked);
                }}
              />
              I have checked these numbers against that page
              {draft.bullet.verified ? null : (
                <Badge tone="warn" className="ml-1">
                  Unverified
                </Badge>
              )}
            </label>
          </div>
        </div>
      </Section>

      <Section title="Muzzle velocity" summary={`${String(draft.muzzleVelocityFps)} fps`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Muzzle velocity"
            suffix="fps"
            value={draft.muzzleVelocityFps}
            onChange={(value) => {
              set('muzzleVelocityFps', value);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mv-source">Where it came from</Label>
            <Select
              id="mv-source"
              value={draft.muzzleVelocitySource}
              onValueChange={(value) => {
                set('muzzleVelocitySource', value);
              }}
              options={MV_SOURCES}
            />
          </div>

          <OptionalNumberField
            label="Measured at temperature"
            suffix="°F"
            value={draft.muzzleVelocityAtTempF ?? null}
            onChange={(value) => {
              set('muzzleVelocityAtTempF', value ?? undefined);
            }}
            emptyHelp="Needed before a powder temperature correction can be applied."
          />

          <OptionalNumberField
            label="Temperature sensitivity"
            suffix="fps/°F"
            step={0.1}
            value={draft.temperatureSensitivityFpsPerF ?? null}
            onChange={(value) => {
              set('temperatureSensitivityFpsPerF', value ?? undefined);
            }}
            emptyHelp="Unknown — no correction will be applied."
            help="Measure it: chronograph the same ammunition warm and cold."
          />
        </div>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Save load
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
