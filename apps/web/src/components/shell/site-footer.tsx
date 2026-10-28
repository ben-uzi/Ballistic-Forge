import Link from 'next/link';
import type { ReactElement } from 'react';

export function SiteFooter(): ReactElement {
  return (
    <footer className="mt-12 border-t border-gunmetal-700 bg-gunmetal-950">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-xs text-ink-500">
        <p className="max-w-3xl leading-relaxed">
          <strong className="text-ink-300">Ballistic Forge produces estimates.</strong> Every
          solution depends on inputs you supply and on a point-mass model of a real projectile.
          Confirm your data with live fire before you rely on it. You are responsible for the safe
          and lawful use of your firearms.
        </p>
        <nav aria-label="More" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink-300" href="/account">
            Account
          </Link>
          <Link className="hover:text-ink-300" href="/feedback">
            Feedback
          </Link>
          <Link className="hover:text-ink-300" href="/onboarding">
            Set up
          </Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink-300" href="/legal/disclaimer">
            Disclaimer
          </Link>
          <Link className="hover:text-ink-300" href="/legal/terms">
            Terms
          </Link>
          <Link className="hover:text-ink-300" href="/legal/privacy">
            Privacy
          </Link>
        </nav>
        <p className="text-ink-700">Built in the Lab. Proven in the Field.</p>
      </div>
    </footer>
  );
}
