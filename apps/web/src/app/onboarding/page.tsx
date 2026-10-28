'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { LoadEditor } from '@/components/profiles/load-editor';
import { RifleEditor } from '@/components/profiles/rifle-editor';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
import { getStore } from '@/lib/store';
import { newLoad, newRifle, touch } from '@/lib/store/factories';
import {
  DEFAULT_UNIT_PREFS,
  type StoredLoad,
  type StoredRifle,
  type UnitPrefs,
} from '@/lib/store/types';

/**
 * Three steps to a real answer.
 *
 * It deliberately ends on an actual solution rather than a "you're all set"
 * screen: the point of the product is the number at the end, and a new user
 * should see one before deciding whether to care.
 */
export default function OnboardingPage(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<UnitPrefs>(DEFAULT_UNIT_PREFS);
  const [rifle, setRifle] = useState<StoredRifle>(() => newRifle({ name: 'My rifle' }));
  const [load, setLoad] = useState<StoredLoad | null>(null);

  const finish = (finalLoad: StoredLoad): void => {
    const store = getStore();
    void store
      .savePrefs(prefs)
      .then(() => store.saveRifle(touch(rifle)))
      .then(() => store.saveLoad(touch(finalLoad)))
      .then(() => {
        router.push(`/calc?load=${finalLoad.id}`);
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title="Set up in three steps"
        subtitle="Units, a rifle, a load — then a real solution"
      />

      <ol className="flex gap-1" aria-label="Progress">
        {[0, 1, 2].map((position) => (
          <li
            key={position}
            className={`h-1 flex-1 rounded-full ${position <= step ? 'bg-forge-500' : 'bg-gunmetal-700'}`}
          />
        ))}
      </ol>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>How do you think about distance?</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>Units</Label>
              <Segmented
                ariaLabel="Unit system"
                className="w-full [&>button]:flex-1"
                value={prefs.range === 'yd' ? 'us' : 'metric'}
                onChange={(choice) => {
                  setPrefs(
                    choice === 'us'
                      ? DEFAULT_UNIT_PREFS
                      : {
                          range: 'm',
                          velocity: 'mps',
                          energy: 'J',
                          temperature: 'C',
                          pressure: 'hPa',
                          angular: prefs.angular,
                        },
                  );
                }}
                options={[
                  { value: 'us', label: 'Yards and fps' },
                  { value: 'metric', label: 'Metres and m/s' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Turrets</Label>
              <Segmented
                ariaLabel="Turret unit"
                className="w-full [&>button]:flex-1"
                value={prefs.angular}
                onChange={(angular) => {
                  setPrefs({ ...prefs, angular });
                }}
                options={[
                  { value: 'mil', label: 'MIL' },
                  { value: 'moa', label: 'MOA' },
                  { value: 'iphy', label: 'IPHY' },
                ]}
              />
              <p className="text-xs text-ink-500">
                Whatever is written on your elevation turret. You can change all of this later.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={() => {
                setStep(1);
              }}
            >
              Next
              <ArrowRight aria-hidden="true" />
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your rifle</CardTitle>
          </CardHeader>
          <CardBody>
            <RifleEditor
              rifle={{ ...rifle, angularUnit: prefs.angular }}
              onSave={(next) => {
                setRifle(next);
                setLoad(newLoad(next.id, { name: 'My load' }));
                setStep(2);
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      {step === 2 && load !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Your load</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink-500">
              The defaults are a 6.5 Creedmoor 140 gr ELD-M. Change them to whatever you actually
              shoot — or leave them and look at the numbers first.
            </p>
            <LoadEditor load={load} onSave={finish} />
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={step === 0}
          onClick={() => {
            setStep((current) => Math.max(0, current - 1));
          }}
        >
          Back
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/calc">
            <Check aria-hidden="true" />
            Skip — just open the calculator
          </Link>
        </Button>
      </div>
    </div>
  );
}
