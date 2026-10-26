import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

export default function NotFound(): ReactElement {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="num text-5xl font-bold text-forge-500">404</p>
      <h1 className="mt-3 text-xl font-semibold text-ink-100">Nothing at that range</h1>
      <p className="mt-2 text-sm text-ink-500">
        Several sections of the app are still being built. The calculator is up and running.
      </p>
      <Button asChild variant="primary" className="mt-6">
        <Link href="/calc">Open the calculator</Link>
      </Button>
    </div>
  );
}
