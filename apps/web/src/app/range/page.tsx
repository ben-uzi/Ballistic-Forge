import type { Metadata } from 'next';
import { Suspense, type ReactElement } from 'react';
import { RangeReadout } from '@/components/range/range-readout';

export const metadata: Metadata = {
  title: 'Range',
  description:
    'One distance, huge numbers, wind on a slider. Built for a phone at the firing line.',
};

export default function RangePage(): ReactElement {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink-500">Loading…</p>}
    >
      <RangeReadout />
    </Suspense>
  );
}
