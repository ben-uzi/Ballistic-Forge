'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { appMode } from '@/lib/env';

const DISMISS_KEY = 'bf.guestPrompt.dismissed.v1';

/**
 * The guest-mode nudge (BUILD_BRIEF §6.2).
 *
 * While the app is in demo mode there is no account to create, so it says what
 * is actually true — profiles live in this browser only — rather than offering
 * a sign-up that does not exist yet. Dismissal is remembered locally.
 */
export function GuestPrompt(): ReactElement | null {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Dismissal just will not stick; not worth surfacing.
    }
  };

  return (
    <aside className="relative rounded-card border border-forge-600/40 bg-forge-500/5 px-4 py-3 pr-10 text-sm text-ink-300">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        className="absolute right-1 top-1 size-9"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </Button>
      {appMode === 'demo' ? (
        <>
          <strong className="text-ink-100">You are in demo mode.</strong> Everything works, but
          rifles, loads and sessions are saved in this browser only — clearing site data erases
          them. Accounts and sync arrive with the backend.
        </>
      ) : (
        <>
          <strong className="text-ink-100">You are shooting as a guest.</strong> Create a free
          account to sync your profiles across devices and contribute to the Field Database.
        </>
      )}
    </aside>
  );
}
