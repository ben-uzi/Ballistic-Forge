import { ShieldAlert } from 'lucide-react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * Required on every solution and every DOPE card (BUILD_BRIEF §13). Rendered
 * with the output, not tucked in the footer, so it travels with the numbers.
 */
export function SolutionDisclaimer({ className }: { readonly className?: string }): ReactElement {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-card border border-gunmetal-700 bg-gunmetal-950 px-3 py-2 text-xs text-ink-500',
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn-500" aria-hidden="true" />
      <span>
        <strong className="text-ink-300">This is an estimate.</strong> It is only as good as the
        velocity, BC and conditions you entered, and it models the bullet as a point mass. Confirm
        it with live fire at distance before you rely on it. You are responsible for the safe and
        lawful use of your firearms.
      </span>
    </p>
  );
}
