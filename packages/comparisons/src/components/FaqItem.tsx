import { ChevronDownIcon } from '../icons';

// One question as a native <details> card, as on each app's /faq: the answer is in the static HTML
// for crawlers and opens without any script.
export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-xs transition open:border-brand-200 open:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:open:border-brand-500/30">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 text-left font-medium text-slate-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{q}</span>
        <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none dark:text-slate-500">
          <ChevronDownIcon size={18} />
        </span>
      </summary>
      <div className="px-5 pb-5 leading-relaxed text-slate-600 dark:text-slate-300">{a}</div>
    </details>
  );
}
