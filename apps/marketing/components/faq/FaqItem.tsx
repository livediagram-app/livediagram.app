import { lucideChevronDown } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import type { ReactNode } from 'react';

const ChevronIcon = lucideGlyph(lucideChevronDown, 18);

// One question as a native <details> card, shared by /faq and the comparison pages' FAQs: the answer is in the
// static HTML for crawlers and opens without any script. Links inside the answer take the brand colour.
export function FaqItem({ q, open, children }: { q: string; open?: boolean; children: ReactNode }) {
  return (
    <details
      open={open}
      className="group rounded-xl border border-slate-200 bg-white shadow-xs transition open:border-brand-200 open:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:open:border-brand-500/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 text-left font-medium text-slate-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{q}</span>
        <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none dark:text-slate-500">
          <ChevronIcon />
        </span>
      </summary>
      <div className="px-5 pb-5 leading-relaxed text-slate-600 dark:text-slate-300 [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:decoration-brand-300 [&_a]:underline-offset-2 hover:[&_a]:decoration-brand-700 dark:[&_a]:text-brand-300 dark:[&_a]:decoration-brand-500/50">
        {children}
      </div>
    </details>
  );
}
