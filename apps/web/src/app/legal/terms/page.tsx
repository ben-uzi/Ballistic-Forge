import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = { title: 'Terms (DRAFT)' };

export default function TermsPage(): ReactElement {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink-100">Terms of use</h1>

      <h2>The pilot</h2>
      <p>
        Ballistic Forge is in a closed pilot. Features may change or disappear, data may be reset,
        and availability is not guaranteed. Do not treat it as a system of record for anything you
        cannot afford to lose.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the service lawfully, and only with firearms you may lawfully possess.</li>
        <li>Do not submit data you do not have the right to share.</li>
        <li>
          Do not submit fabricated chronograph or field data. The value of the Field Database rests
          entirely on it being real.
        </li>
        <li>Do not attempt to deanonymise other contributors.</li>
      </ul>

      <h2>What this service is not</h2>
      <p>
        It is not a source of reloading data, legal advice, or guidance on the acquisition or
        transfer of regulated items. See the{' '}
        <a className="text-forge-500 underline" href="/legal/disclaimer">
          disclaimer
        </a>{' '}
        for the limits of the calculations themselves.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of the data you enter. By opting in to contribute field data you grant
        permission to include it in anonymised, aggregated statistics. You can withdraw that
        permission and have your contribution removed from future aggregates.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided as is. To the maximum extent permitted by law, the authors are not
        liable for any loss or damage arising from its use.
      </p>

      <h2>Changes</h2>
      <p>These terms will be rewritten by an attorney before the beta opens.</p>
    </>
  );
}
