import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { SessionWizard } from '@/components/sessions/session-wizard';

export const metadata: Metadata = {
  title: 'Log a session',
  description: 'Record chronograph strings, conditions and observed drop from a range session.',
};

export default function NewSessionPage(): ReactElement {
  return <SessionWizard />;
}
