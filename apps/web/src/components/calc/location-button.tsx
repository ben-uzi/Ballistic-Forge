'use client';

import { MapPin } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';

export interface LocationResult {
  /** Rounded to 0.1 degrees (~11 km) before it ever reaches state. */
  readonly latitudeDeg: number;
  /** Metres above the ellipsoid, when the device reports it. */
  readonly altitudeM: number | null;
}

/**
 * Opt-in coarse location (BUILD_BRIEF §6.2, §10.4).
 *
 * The latitude is rounded to 0.1° immediately — enough for Coriolis, nowhere
 * near enough to identify a shooting position — and nothing is sent anywhere or
 * written to storage. Longitude is never read at all.
 */
export function LocationButton({
  onResult,
}: {
  readonly onResult: (result: LocationResult) => void;
}): ReactElement {
  const [state, setState] = useState<'idle' | 'working' | 'denied' | 'unsupported'>('idle');

  const request = (): void => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState('unsupported');
      return;
    }
    setState('working');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState('idle');
        onResult({
          latitudeDeg: Math.round(position.coords.latitude * 10) / 10,
          altitudeM: position.coords.altitude ?? null,
        });
      },
      () => {
        setState('denied');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={request}
        disabled={state === 'working'}
      >
        <MapPin aria-hidden="true" />
        {state === 'working' ? 'Locating…' : 'Use my location'}
      </Button>
      <p className="text-xs text-ink-700">
        {state === 'denied'
          ? 'Location permission was declined. Enter latitude and altitude by hand.'
          : state === 'unsupported'
            ? 'This browser has no location API. Enter latitude and altitude by hand.'
            : 'Fills latitude (rounded to 0.1°) and altitude if your device reports it. Nothing is stored or sent.'}
      </p>
    </div>
  );
}
