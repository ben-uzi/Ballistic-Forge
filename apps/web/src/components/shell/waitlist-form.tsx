'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import type { WaitlistResponse } from '@/app/api/waitlist/route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done'; readonly stored: 'supabase' | 'local' }
  | { readonly kind: 'error'; readonly message: string };

export function WaitlistForm(): ReactElement {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setState({ kind: 'sending' });

    void fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(async (response) => {
        const data = (await response.json()) as WaitlistResponse;
        if (data.ok) setState({ kind: 'done', stored: data.stored });
        else setState({ kind: 'error', message: data.error });
      })
      .catch(() => {
        setState({ kind: 'error', message: 'That did not go through. Try again in a moment.' });
      });
  };

  if (state.kind === 'done') {
    return (
      <p className="rounded-card border border-pass-500/40 bg-pass-500/10 px-4 py-3 text-sm text-pass-500">
        {state.stored === 'local'
          ? 'Logged on the server — but the beta list is not connected to a database yet, so consider this a soft yes rather than a reserved seat.'
          : 'You are on the list. We will be in touch before the beta opens.'}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="waitlist-email">Join the beta</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="font-sans sm:flex-1"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <Button type="submit" variant="primary" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending…' : 'Request an invite'}
        </Button>
      </div>
      {state.kind === 'error' ? (
        <p className="text-xs text-fail-500">{state.message}</p>
      ) : (
        <p className="text-xs text-ink-700">
          Twenty to fifty testers for the pilot. Your address is used for the beta and nothing else.
        </p>
      )}
    </form>
  );
}
