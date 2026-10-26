'use client';

import { convertLength } from '@bf/engine';
import type { ReactElement } from 'react';
import type { GroupProps } from './group-props';
import { LocationButton } from './location-button';
import { NumberField } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { UNIT_LABEL } from '@/lib/calc/format';
import { messageFor } from '@/lib/calc/issues';

/** The clock face, written the way a wind call is actually given. */
const CLOCK_LABEL: Readonly<Record<number, string>> = {
  12: 'headwind',
  3: 'from the right',
  6: 'tailwind',
  9: 'from the left',
};

function clockDescription(clock: number): string {
  const whole = Math.round(clock);
  return CLOCK_LABEL[whole] ?? `${whole} o’clock`;
}

export function ConditionsGroup({ form, set, setUnits, issues }: GroupProps): ReactElement {
  const { units } = form;
  const summary = [
    `${form.temperature} ${UNIT_LABEL[units.temperature]}`,
    `${form.pressure} ${UNIT_LABEL[units.pressure]} ${form.pressureType}`,
    `${form.windSpeed} ${UNIT_LABEL[units.windSpeed]} @ ${Math.round(form.windFromClock)}`,
  ].join(' · ');

  return (
    <Section title="Conditions" summary={summary}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <NumberField
            label="Temperature"
            className="flex-1"
            value={form.temperature}
            onChange={(value) => {
              set('temperature', value);
            }}
            suffix={UNIT_LABEL[units.temperature]}
            error={messageFor(issues, 'temperature')}
          />
          <Segmented
            ariaLabel="Temperature unit"
            size="sm"
            className="mb-1"
            value={units.temperature}
            onChange={(temperature) => {
              setUnits({ temperature });
            }}
            options={[
              { value: 'F', label: '°F' },
              { value: 'C', label: '°C' },
            ]}
          />
        </div>

        <div className="flex items-end gap-2">
          <NumberField
            label="Altitude"
            className="flex-1"
            value={form.altitude}
            onChange={(value) => {
              set('altitude', value);
            }}
            suffix={UNIT_LABEL[units.altitude]}
            error={messageFor(issues, 'altitude')}
          />
          <Segmented
            ariaLabel="Altitude unit"
            size="sm"
            className="mb-1"
            value={units.altitude}
            onChange={(altitude) => {
              setUnits({ altitude });
            }}
            options={[
              { value: 'ft', label: 'ft' },
              { value: 'm', label: 'm' },
            ]}
          />
        </div>

        <div className="flex items-end gap-2">
          <NumberField
            label="Pressure"
            className="flex-1"
            value={form.pressure}
            onChange={(value) => {
              set('pressure', value);
            }}
            step={0.01}
            suffix={UNIT_LABEL[units.pressure]}
            error={messageFor(issues, 'pressure')}
          />
          <Segmented
            ariaLabel="Pressure unit"
            size="sm"
            className="mb-1"
            value={units.pressure}
            onChange={(pressure) => {
              setUnits({ pressure });
            }}
            options={[
              { value: 'inHg', label: 'inHg' },
              { value: 'hPa', label: 'hPa' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Pressure type</Label>
          <Segmented
            ariaLabel="Pressure type"
            className="w-full [&>button]:flex-1"
            value={form.pressureType}
            onChange={(pressureType) => {
              set('pressureType', pressureType);
            }}
            options={[
              {
                value: 'station',
                label: 'Station',
                title: 'Absolute pressure read where you are standing',
              },
              {
                value: 'baro',
                label: 'Barometric',
                title: 'Sea-level corrected, as reported by weather services',
              },
            ]}
          />
          <p className="text-xs text-ink-700">
            {form.pressureType === 'station'
              ? 'A Kestrel reads station pressure. Altitude is then only used for the density-altitude readout.'
              : 'Weather apps and METARs report barometric (sea-level) pressure. Your altitude is used to correct it.'}
          </p>
        </div>

        <NumberField
          label="Relative humidity"
          value={form.humidity}
          onChange={(value) => {
            set('humidity', value);
          }}
          suffix="%"
          min={0}
          max={100}
          error={messageFor(issues, 'humidity')}
          help="A small effect — within a few tenths of a mil at 1,000 yd."
        />

        <div className="flex items-end gap-2">
          <NumberField
            label="Wind speed"
            className="flex-1"
            value={form.windSpeed}
            onChange={(value) => {
              set('windSpeed', value);
            }}
            suffix={UNIT_LABEL[units.windSpeed]}
            error={messageFor(issues, 'windSpeed')}
          />
          <Segmented
            ariaLabel="Wind speed unit"
            size="sm"
            className="mb-1"
            value={units.windSpeed}
            onChange={(windSpeed) => {
              setUnits({ windSpeed });
            }}
            options={[
              { value: 'mph', label: 'mph' },
              { value: 'mps', label: 'm/s' },
              { value: 'kph', label: 'km/h' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="wind-clock">Wind from</Label>
            <span className="num text-sm text-forge-500">
              {Math.round(form.windFromClock)} {'—'} {clockDescription(form.windFromClock)}
            </span>
          </div>
          <Slider
            id="wind-clock"
            aria-label="Wind clock position"
            min={1}
            max={12}
            step={1}
            value={[form.windFromClock]}
            onValueChange={(values) => {
              const next = values[0];
              if (next !== undefined) set('windFromClock', next);
            }}
          />
          <p className="text-xs text-ink-700">
            The clock position the wind is coming from, as you face the target. 12 is a headwind, 3
            comes from your right.
          </p>
        </div>

        <NumberField
          label="Incline"
          value={form.inclineDeg}
          onChange={(value) => {
            set('inclineDeg', value);
          }}
          suffix="°"
          error={messageFor(issues, 'inclineDeg')}
          help="Positive uphill, negative downhill. Both shoot high."
        />
      </div>

      <div className="mt-6 space-y-4 border-t border-gunmetal-700 pt-4">
        <Toggle
          label="Spin drift"
          description="Miller stability and the Litz drift estimate. Needs twist rate and bullet length."
          checked={form.spinDriftEnabled}
          onChange={(checked) => {
            set('spinDriftEnabled', checked);
          }}
        />

        <Toggle
          label="Aerodynamic jump"
          description="Litz approximation, not yet verified against the source — leave it off unless you know you want it."
          checked={form.aerodynamicJumpEnabled}
          onChange={(checked) => {
            set('aerodynamicJumpEnabled', checked);
          }}
        />

        <Toggle
          label="Coriolis"
          description="Matters past roughly 1,000 yd. Needs your latitude and the direction you are firing."
          checked={form.coriolisEnabled}
          onChange={(checked) => {
            set('coriolisEnabled', checked);
          }}
        />

        {form.coriolisEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Latitude"
              value={form.latitudeDeg}
              onChange={(value) => {
                set('latitudeDeg', value);
              }}
              suffix="°N"
              error={messageFor(issues, 'latitudeDeg')}
              help="Negative in the southern hemisphere."
            />
            <NumberField
              label="Azimuth of fire"
              value={form.azimuthDeg}
              onChange={(value) => {
                set('azimuthDeg', value);
              }}
              suffix="°"
              error={messageFor(issues, 'azimuthDeg')}
              help="Clockwise from true north. 0 is north, 90 is east."
            />
            <div className="sm:col-span-2">
              <LocationButton
                onResult={({ latitudeDeg, altitudeM }) => {
                  set('latitudeDeg', latitudeDeg);
                  if (altitudeM !== null) {
                    set('altitude', Math.round(convertLength(altitudeM, 'm', units.altitude)));
                  }
                }}
              />
            </div>
          </div>
        ) : null}

        <Toggle
          label="Zeroed in different conditions"
          description="Use when you zeroed somewhere colder, hotter or higher than where you are shooting."
          checked={form.useZeroAtmosphere}
          onChange={(checked) => {
            set('useZeroAtmosphere', checked);
          }}
        />

        {form.useZeroAtmosphere ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Temperature at zero"
              value={form.zeroTemperature}
              onChange={(value) => {
                set('zeroTemperature', value);
              }}
              suffix={UNIT_LABEL[units.temperature]}
              error={messageFor(issues, 'zeroTemperature')}
            />
            <NumberField
              label="Altitude at zero"
              value={form.zeroAltitude}
              onChange={(value) => {
                set('zeroAltitude', value);
              }}
              suffix={UNIT_LABEL[units.altitude]}
              error={messageFor(issues, 'zeroAltitude')}
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-100">{label}</span>
        <span className="text-xs text-ink-700">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-1" />
    </label>
  );
}
