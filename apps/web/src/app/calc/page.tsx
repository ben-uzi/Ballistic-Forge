import type { Metadata } from 'next';
import { Suspense, type ReactElement } from 'react';
import { Calculator } from '@/components/calc/calculator';

export const metadata: Metadata = {
  title: 'The Lab',
  description:
    'Point-mass ballistic solver with humid-air density, wind, spin drift, Coriolis and incline. Works logged out.',
};

export default function CalcPage(): ReactElement {
  // The calculator reads ?load= from the query string, which needs a Suspense
  // boundary while the page is prerendered.
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-500">Loading…</p>}
    >
      <Calculator />
    </Suspense>
  );
}
