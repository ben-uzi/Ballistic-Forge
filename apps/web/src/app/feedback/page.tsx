'use client';

import { Send } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { FeedbackResponse } from '@/app/api/feedback/route';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; stored: 'supabase' | 'local' }
  | { kind: 'error'; message: string };

export default function FeedbackPage(): ReactElement {
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setState({ kind: 'sending' });
    void fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        url: typeof window === 'undefined' ? undefined : window.location.href,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as FeedbackResponse;
        if (data.ok) setState({ kind: 'done', stored: data.stored });
        else setState({ kind: 'error', message: data.error });
      })
      .catch(() => {
        setState({ kind: 'error', message: 'That did not go through. Try again in a moment.' });
      });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <PageHeader
        title="Feedback"
        subtitle="Wrong numbers, broken pages, missing features — all of it is useful"
      />

      <Card>
        <CardHeader>
          <CardTitle>Tell us what happened</CardTitle>
        </CardHeader>
        <CardBody>
          {state.kind === 'done' ? (
            <p className="rounded-card border border-pass-500/40 bg-pass-500/10 px-4 py-3 text-sm text-pass-500">
              {state.stored === 'local'
                ? 'Logged on the server — but there is no database connected yet, so treat this as read rather than recorded.'
                : 'Received. If it is a correction to library data it goes to the review queue, not straight into the library.'}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fb-message">What is wrong, or what is missing?</Label>
                <textarea
                  id="fb-message"
                  rows={6}
                  required
                  className="w-full rounded-md border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-base text-ink-100 focus:border-forge-600 focus:outline-none"
                  placeholder="The G7 BC on the 6.5mm 147 ELD-M looks wrong — Hornady lists 0.351 at Mach 2.25."
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                  }}
                />
                <p className="text-xs text-ink-500">
                  If you are correcting a figure, include the manufacturer page you are reading it
                  from. Corrections are never applied without a human checking the source.
                </p>
              </div>

              <Button type="submit" variant="primary" disabled={state.kind === 'sending'}>
                <Send aria-hidden="true" />
                {state.kind === 'sending' ? 'Sending…' : 'Send'}
              </Button>

              {state.kind === 'error' ? (
                <p className="text-xs text-fail-500">{state.message}</p>
              ) : null}
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
