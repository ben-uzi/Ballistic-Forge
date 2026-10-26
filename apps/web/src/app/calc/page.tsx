import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { Calculator } from '@/components/calc/calculator';

export const metadata: Metadata = {
  title: 'The Lab',
  description:
    'Point-mass ballistic solver with humid-air density, wind, spin drift, Coriolis and incline. Works logged out.',
};

export default function CalcPage(): ReactElement {
  return <Calculator />;
}
