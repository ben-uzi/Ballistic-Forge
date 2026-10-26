import { FileWarning } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Every legal page carries the same DRAFT banner. These are placeholders
 * written by the build, not by a lawyer, and must be reviewed before the beta
 * opens (NEEDS_CHAD 6).
 */
export default function LegalLayout({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-8 flex items-start gap-2 rounded-card border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500">
        <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>DRAFT — not legal advice and not reviewed by an attorney.</strong> This text is a
          placeholder so the pilot has something honest in place. It will be replaced before the
          beta opens.
        </span>
      </p>
      <article className="space-y-6 text-sm leading-relaxed text-ink-300 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-100 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </article>
    </div>
  );
}
