'use client';

import { Download, Trash2, Upload } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { appMode } from '@/lib/env';
import { exportCsvBundle, exportJson } from '@/lib/account/export';
import { getStore } from '@/lib/store';
import { DEFAULT_UNIT_PREFS, type StoreSnapshot, type UnitPrefs } from '@/lib/store/types';
import { useTier } from '@/lib/entitlements-hook';

const CONTRIBUTE_KEY = 'bf.contribute.v1';

export default function AccountPage(): ReactElement {
  const [prefs, setPrefs] = useState<UnitPrefs>(DEFAULT_UNIT_PREFS);
  const [contribute, setContribute] = useState(true);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const tier = useTier();

  useEffect(() => {
    void getStore().getPrefs().then(setPrefs);
    try {
      setContribute(window.localStorage.getItem(CONTRIBUTE_KEY) !== '0');
    } catch {
      // Default to opted in, which is what the stored value would have said.
    }
  }, []);

  const savePrefs = (next: UnitPrefs): void => {
    setPrefs(next);
    void getStore().savePrefs(next);
  };

  const download = (name: string, body: string, type: string): void => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title="Account"
        subtitle={
          appMode === 'demo' ? 'Demo mode — everything is stored in this browser' : undefined
        }
        actions={<Badge tone="forge">{tier}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <UnitChoice
            label="Range"
            value={prefs.range}
            onChange={(range) => {
              savePrefs({ ...prefs, range });
            }}
            options={[
              { value: 'yd', label: 'yards' },
              { value: 'm', label: 'metres' },
            ]}
          />
          <UnitChoice
            label="Velocity"
            value={prefs.velocity}
            onChange={(velocity) => {
              savePrefs({ ...prefs, velocity });
            }}
            options={[
              { value: 'fps', label: 'fps' },
              { value: 'mps', label: 'm/s' },
            ]}
          />
          <UnitChoice
            label="Temperature"
            value={prefs.temperature}
            onChange={(temperature) => {
              savePrefs({ ...prefs, temperature });
            }}
            options={[
              { value: 'F', label: '°F' },
              { value: 'C', label: '°C' },
            ]}
          />
          <UnitChoice
            label="Pressure"
            value={prefs.pressure}
            onChange={(pressure) => {
              savePrefs({ ...prefs, pressure });
            }}
            options={[
              { value: 'inHg', label: 'inHg' },
              { value: 'hPa', label: 'hPa' },
            ]}
          />
          <UnitChoice
            label="Energy"
            value={prefs.energy}
            onChange={(energy) => {
              savePrefs({ ...prefs, energy });
            }}
            options={[
              { value: 'ftlbf', label: 'ft·lb' },
              { value: 'J', label: 'joules' },
            ]}
          />
          <UnitChoice
            label="Turrets"
            value={prefs.angular}
            onChange={(angular) => {
              savePrefs({ ...prefs, angular });
            }}
            options={[
              { value: 'mil', label: 'MIL' },
              { value: 'moa', label: 'MOA' },
              { value: 'iphy', label: 'IPHY' },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The Field Database</CardTitle>
        </CardHeader>
        <CardBody>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-100">Contribute my sessions</span>
              <span className="text-xs text-ink-500">
                Anonymised velocities from sessions you log feed the community aggregates. Your own
                history is unaffected either way, and turning this off removes your data from future
                aggregates.
              </span>
            </span>
            <Switch
              checked={contribute}
              onCheckedChange={(checked) => {
                setContribute(checked);
                try {
                  window.localStorage.setItem(CONTRIBUTE_KEY, checked ? '1' : '0');
                } catch {
                  // The in-session choice still applies.
                }
              }}
              aria-label="Contribute my sessions"
              className="mt-1"
            />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-500">
            Everything you have entered, in formats you can actually use. No account required and
            nothing is sent anywhere to produce them.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                void getStore()
                  .exportAll()
                  .then((snapshot) => {
                    download(
                      `ballistic-forge-${snapshot.exportedAt.slice(0, 10)}.json`,
                      exportJson(snapshot),
                      'application/json',
                    );
                    setStatus('Exported as JSON.');
                  });
              }}
            >
              <Download aria-hidden="true" />
              Export JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void getStore()
                  .exportAll()
                  .then((snapshot) => {
                    download(
                      `ballistic-forge-${snapshot.exportedAt.slice(0, 10)}.csv`,
                      exportCsvBundle(snapshot),
                      'text/csv',
                    );
                    setStatus('Exported as CSV.');
                  });
              }}
            >
              <Download aria-hidden="true" />
              Export CSV
            </Button>

            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-gunmetal-700 bg-gunmetal-800 px-4 text-sm text-ink-100 hover:bg-gunmetal-700">
              <Upload className="size-4" aria-hidden="true" />
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file === undefined) return;
                  void file.text().then((text) => {
                    try {
                      const snapshot = JSON.parse(text) as StoreSnapshot;
                      void getStore()
                        .importAll(snapshot)
                        .then(() => {
                          setStatus('Imported. Reload to see it.');
                        });
                    } catch {
                      setStatus('That file could not be read as a Ballistic Forge export.');
                    }
                  });
                }}
              />
            </label>
          </div>
          {status === null ? null : <p className="text-xs text-ink-500">{status}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete everything</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-500">
            Removes every rifle, load, suppressor and session from this browser. Export first if you
            want a copy — this cannot be undone.
          </p>
          {confirmWipe ? (
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-fail-500/40 bg-fail-500/10 px-4 py-3">
              <p className="flex-1 text-sm text-fail-500">Delete all local data permanently?</p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  void getStore()
                    .clearAll()
                    .then(() => {
                      setConfirmWipe(false);
                      setStatus('All local data deleted.');
                    });
                }}
              >
                Delete everything
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmWipe(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmWipe(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete all local data
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function UnitChoice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  readonly label: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly { value: T; label: string }[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Segmented
        ariaLabel={label}
        className="w-full [&>button]:flex-1"
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}
