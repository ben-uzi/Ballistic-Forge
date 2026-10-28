'use client';

import { useState, type ChangeEvent, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { MountType, StoredSuppressor } from '@/lib/store/types';

export const MOUNT_OPTIONS: readonly { value: MountType; label: string }[] = [
  { value: 'direct_thread', label: 'Direct thread' },
  { value: 'hub_1375x24', label: 'HUB (1.375x24)' },
  { value: 'asr', label: 'ASR' },
  { value: 'keymo', label: 'KeyMo' },
  { value: 'omega_qd', label: 'Omega QD' },
  { value: 'proprietary_qd', label: 'Proprietary QD' },
  { value: 'other', label: 'Other / unknown' },
];

/**
 * Suppressor specification form.
 *
 * Every field except the name and mount is optional, and leaving one blank is a
 * real answer: the compatibility checker reports "unknown" from a missing
 * value, which is the behaviour the whole module is built around. The help text
 * says so, so nobody feels obliged to fill a box with a guess.
 */
export function SuppressorEditor({
  suppressor,
  onSave,
  onCancel,
}: {
  readonly suppressor: StoredSuppressor;
  readonly onSave: (suppressor: StoredSuppressor) => void;
  readonly onCancel?: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(suppressor);

  const set = <K extends keyof StoredSuppressor>(key: K, value: StoredSuppressor[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const text = (key: 'manufacturer' | 'threadPitch' | 'maxRatedCartridge' | 'sourceUrl') => ({
    value: draft[key] ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement>): void => {
      set(key, event.target.value === '' ? undefined : event.target.value);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <p className="rounded-card border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-xs text-ink-500">
        Leave anything the manufacturer does not publish blank. The compatibility checker treats a
        blank as &ldquo;unknown&rdquo; and will never call something compatible on a guess.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="can-name">Name</Label>
          <Input
            id="can-name"
            className="font-sans"
            required
            value={draft.name}
            onChange={(event) => {
              set('name', event.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="can-manufacturer">Manufacturer</Label>
          <Input id="can-manufacturer" className="font-sans" {...text('manufacturer')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="can-mount">Mount type</Label>
          <Select
            id="can-mount"
            value={draft.mountType}
            onValueChange={(value) => {
              set('mountType', value);
            }}
            options={MOUNT_OPTIONS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="can-thread">Thread pitch</Label>
          <Input
            id="can-thread"
            className="font-sans"
            placeholder="5/8x24"
            {...text('threadPitch')}
          />
          <p className="text-xs text-ink-500">
            For a direct-thread can, the thread it screws onto.
          </p>
        </div>

        <OptionalNumberField
          label="Bore diameter"
          suffix="in"
          step={0.001}
          value={draft.boreDiameterIn ?? null}
          onChange={(value) => {
            set('boreDiameterIn', value ?? undefined);
          }}
          emptyHelp="Unknown — bore clearance cannot be checked."
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="can-max-cartridge">Maximum rated cartridge</Label>
          <Input
            id="can-max-cartridge"
            className="font-sans"
            placeholder=".300 Winchester Magnum"
            {...text('maxRatedCartridge')}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="can-rated">Rated cartridges</Label>
          <Input
            id="can-rated"
            className="font-sans"
            placeholder=".308 Winchester; 6.5 Creedmoor; .300 Win Mag"
            value={draft.ratedCartridges.join('; ')}
            onChange={(event) => {
              set(
                'ratedCartridges',
                event.target.value
                  .split(';')
                  .map((entry) => entry.trim())
                  .filter((entry) => entry !== ''),
              );
            }}
          />
          <p className="text-xs text-ink-500">
            Semicolon separated, exactly as the manufacturer lists them.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="can-barrel-note">Minimum barrel length note</Label>
          <Input
            id="can-barrel-note"
            className="font-sans"
            placeholder="16 in minimum for .300 Win Mag"
            value={draft.minBarrelLengthNote ?? ''}
            onChange={(event) => {
              set(
                'minBarrelLengthNote',
                event.target.value === '' ? undefined : event.target.value,
              );
            }}
          />
          <p className="text-xs text-ink-500">
            Copy it word for word. It is shown verbatim and never interpreted.
          </p>
        </div>

        <OptionalNumberField
          label="Length"
          suffix="in"
          step={0.1}
          value={draft.lengthIn ?? null}
          onChange={(value) => {
            set('lengthIn', value ?? undefined);
          }}
        />
        <OptionalNumberField
          label="Diameter"
          suffix="in"
          step={0.001}
          value={draft.diameterIn ?? null}
          onChange={(value) => {
            set('diameterIn', value ?? undefined);
          }}
        />
        <OptionalNumberField
          label="Weight"
          suffix="oz"
          step={0.1}
          value={draft.weightOz ?? null}
          onChange={(value) => {
            set('weightOz', value ?? undefined);
          }}
        />

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="can-source">Source URL</Label>
          <Input
            id="can-source"
            type="url"
            className="font-sans"
            placeholder="https://..."
            {...text('sourceUrl')}
          />
          <label className="flex items-center gap-2 text-xs text-ink-500">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-forge-500)]"
              checked={draft.verified}
              onChange={(event) => {
                set('verified', event.target.checked);
              }}
            />
            I have checked these figures against that page
            {draft.verified ? null : (
              <Badge tone="warn" className="ml-1">
                Unverified
              </Badge>
            )}
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Save suppressor
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
