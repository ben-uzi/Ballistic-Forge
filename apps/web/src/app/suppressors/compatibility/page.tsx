'use client';

import { checkSuppressorFit, type HostFitSpec, type SuppressorFitSpec } from '@bf/engine';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { MOUNT_OPTIONS } from '@/components/suppressors/suppressor-editor';
import { FitVerdict } from '@/components/suppressors/fit-result';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { OptionalNumberField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { useLoads, useRifles, useSuppressors } from '@/lib/store/hooks';
import type { MountType } from '@/lib/store/types';

/**
 * The standalone compatibility checker.
 *
 * Works entirely from what is typed in, so it is useful before anything is
 * saved. Saved rifles and suppressors can be loaded in as a starting point.
 */
export default function CompatibilityPage(): ReactElement {
  const { data: suppressors } = useSuppressors();
  const { data: rifles } = useRifles();
  const { data: loads } = useLoads();

  const [can, setCan] = useState<{
    name: string;
    mountType: MountType;
    threadPitch: string;
    boreDiameterIn: number | null;
    maxRatedCartridge: string;
    ratedCartridges: string;
    minBarrelLengthNote: string;
  }>({
    name: '',
    mountType: 'direct_thread',
    threadPitch: '',
    boreDiameterIn: null,
    maxRatedCartridge: '',
    ratedCartridges: '',
    minBarrelLengthNote: '',
  });

  const [host, setHost] = useState<{
    cartridge: string;
    bulletDiameterIn: number | null;
    threadPitch: string;
    barrelLengthIn: number | null;
  }>({
    cartridge: '',
    bulletDiameterIn: null,
    threadPitch: '',
    barrelLengthIn: null,
  });

  const result = useMemo(() => {
    const spec: SuppressorFitSpec = {
      mountType: can.mountType,
      ratedCartridges: can.ratedCartridges
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
      ...(can.threadPitch === '' ? {} : { threadPitch: can.threadPitch }),
      ...(can.boreDiameterIn === null ? {} : { boreDiameterIn: can.boreDiameterIn }),
      ...(can.maxRatedCartridge === '' ? {} : { maxRatedCartridge: can.maxRatedCartridge }),
      ...(can.minBarrelLengthNote === '' ? {} : { minBarrelLengthNote: can.minBarrelLengthNote }),
    };
    const hostSpec: HostFitSpec = {
      ...(host.cartridge === '' ? {} : { cartridge: host.cartridge }),
      ...(host.bulletDiameterIn === null ? {} : { bulletDiameterIn: host.bulletDiameterIn }),
      ...(host.threadPitch === '' ? {} : { threadPitch: host.threadPitch }),
      ...(host.barrelLengthIn === null ? {} : { barrelLengthIn: host.barrelLengthIn }),
    };
    return checkSuppressorFit(spec, hostSpec);
  }, [can, host]);

  const savedCans = suppressors.filter((entry) => entry.archived !== true);
  const savedRifles = rifles.filter((entry) => entry.archived !== true);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href="/suppressors" className="hover:text-ink-300">
          The Can
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">Compatibility</span>
      </nav>

      <PageHeader
        title="Compatibility checker"
        subtitle="What the published figures say, and what they do not say"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Suppressor</CardTitle>
            {savedCans.length === 0 ? null : (
              <Select
                ariaLabel="Load a saved suppressor"
                className="w-44"
                placeholder="Load saved"
                value=""
                onValueChange={(id) => {
                  const found = savedCans.find((entry) => entry.id === id);
                  if (found === undefined) return;
                  setCan({
                    name: found.name,
                    mountType: found.mountType,
                    threadPitch: found.threadPitch ?? '',
                    boreDiameterIn: found.boreDiameterIn ?? null,
                    maxRatedCartridge: found.maxRatedCartridge ?? '',
                    ratedCartridges: found.ratedCartridges.join('; '),
                    minBarrelLengthNote: found.minBarrelLengthNote ?? '',
                  });
                }}
                options={savedCans.map((entry) => ({ value: entry.id, label: entry.name }))}
              />
            )}
          </CardHeader>
          <CardBody className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-mount">Mount type</Label>
              <Select
                id="fit-mount"
                value={can.mountType}
                onValueChange={(value) => {
                  setCan((c) => ({ ...c, mountType: value }));
                }}
                options={MOUNT_OPTIONS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-can-thread">Suppressor thread</Label>
              <Input
                id="fit-can-thread"
                className="font-sans"
                placeholder="5/8x24"
                value={can.threadPitch}
                onChange={(event) => {
                  setCan((c) => ({ ...c, threadPitch: event.target.value }));
                }}
              />
            </div>

            <OptionalNumberField
              label="Bore diameter"
              suffix="in"
              step={0.001}
              value={can.boreDiameterIn}
              onChange={(value) => {
                setCan((c) => ({ ...c, boreDiameterIn: value }));
              }}
              emptyHelp="Unknown — bore clearance cannot be checked."
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-max">Maximum rated cartridge</Label>
              <Input
                id="fit-max"
                className="font-sans"
                placeholder=".300 Winchester Magnum"
                value={can.maxRatedCartridge}
                onChange={(event) => {
                  setCan((c) => ({ ...c, maxRatedCartridge: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-rated">Rated cartridges</Label>
              <Input
                id="fit-rated"
                className="font-sans"
                placeholder=".308 Winchester; 6.5 Creedmoor"
                value={can.ratedCartridges}
                onChange={(event) => {
                  setCan((c) => ({ ...c, ratedCartridges: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-note">Minimum barrel length note</Label>
              <Input
                id="fit-note"
                className="font-sans"
                value={can.minBarrelLengthNote}
                onChange={(event) => {
                  setCan((c) => ({ ...c, minBarrelLengthNote: event.target.value }));
                }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Rifle</CardTitle>
            {savedRifles.length === 0 ? null : (
              <Select
                ariaLabel="Load a saved rifle"
                className="w-44"
                placeholder="Load saved"
                value=""
                onValueChange={(id) => {
                  const found = savedRifles.find((entry) => entry.id === id);
                  if (found === undefined) return;
                  const bullet = loads.find((load) => load.rifleId === found.id)?.bullet;
                  setHost({
                    cartridge: found.cartridge,
                    bulletDiameterIn: bullet?.diameterIn ?? null,
                    threadPitch: found.threadPitch ?? '',
                    barrelLengthIn: found.barrelLengthIn ?? null,
                  });
                }}
                options={savedRifles.map((entry) => ({ value: entry.id, label: entry.name }))}
              />
            )}
          </CardHeader>
          <CardBody className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-cartridge">Cartridge</Label>
              <Input
                id="fit-cartridge"
                className="font-sans"
                placeholder="6.5 Creedmoor"
                value={host.cartridge}
                onChange={(event) => {
                  setHost((h) => ({ ...h, cartridge: event.target.value }));
                }}
              />
            </div>

            <OptionalNumberField
              label="Bullet diameter"
              suffix="in"
              step={0.001}
              value={host.bulletDiameterIn}
              onChange={(value) => {
                setHost((h) => ({ ...h, bulletDiameterIn: value }));
              }}
              emptyHelp="Unknown — bore clearance cannot be checked."
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fit-host-thread">Muzzle thread</Label>
              <Input
                id="fit-host-thread"
                className="font-sans"
                placeholder="5/8x24"
                value={host.threadPitch}
                onChange={(event) => {
                  setHost((h) => ({ ...h, threadPitch: event.target.value }));
                }}
              />
            </div>

            <OptionalNumberField
              label="Barrel length"
              suffix="in"
              value={host.barrelLengthIn}
              onChange={(value) => {
                setHost((h) => ({ ...h, barrelLengthIn: value }));
              }}
            />
          </CardBody>
        </Card>
      </div>

      <FitVerdict result={result} />

      <div className="flex flex-wrap gap-3 text-xs text-ink-500">
        <span>Official resources:</span>
        <a
          className="text-forge-500 underline"
          href="https://www.atf.gov/firearms"
          target="_blank"
          rel="noreferrer noopener"
        >
          ATF firearms information
        </a>
        <a
          className="text-forge-500 underline"
          href="https://pewscience.com/"
          target="_blank"
          rel="noreferrer noopener"
        >
          PEW Science (independent suppressor testing)
        </a>
      </div>

      <Button asChild variant="ghost" size="sm">
        <Link href="/suppressors">Back to The Can</Link>
      </Button>
    </div>
  );
}
