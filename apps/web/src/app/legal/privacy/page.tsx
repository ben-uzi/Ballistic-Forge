import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = { title: 'Privacy (DRAFT)' };

export default function PrivacyPage(): ReactElement {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink-100">Privacy</h1>

      <h2>What the pilot collects</h2>
      <p>
        Today the calculator runs entirely in your browser. Your rifles, loads and calculator
        settings are stored in this browser&rsquo;s local storage and are not transmitted anywhere.
        If you submit the beta waitlist form, your email address is sent to the server.
      </p>

      <h2>What is deliberately never collected</h2>
      <ul>
        <li>
          <strong>Firearm serial numbers.</strong> There is no field for one anywhere in the
          product, by design.
        </li>
        <li>
          <strong>Precise location.</strong> The optional &ldquo;use my location&rdquo; button reads
          your latitude only, rounds it to a tenth of a degree — roughly eleven kilometres — and
          uses it for the Coriolis calculation. Longitude is never read. Nothing is stored or sent.
        </li>
        <li>
          <strong>Third-party trackers.</strong> There are no analytics scripts, advertising pixels
          or session recorders on this site.
        </li>
      </ul>

      <h2>Field data, when it arrives</h2>
      <p>
        Shot sessions you log will feed an aggregate model. Contribution will be opt-in, aggregates
        will be published only when enough distinct users and sessions are behind a number, and
        deleting your data will trigger a recomputation that removes your contribution. Those
        guarantees are written into the design rather than bolted on afterwards.
      </p>

      <h2>Export and deletion</h2>
      <p>
        You will be able to export everything you have entered as JSON and CSV, and to delete your
        account and its data. Until accounts exist, clearing this site&rsquo;s data in your browser
        removes everything the app holds about you.
      </p>

      <h2>Contact</h2>
      <p>A contact route for privacy requests will be published before the beta opens.</p>
    </>
  );
}
