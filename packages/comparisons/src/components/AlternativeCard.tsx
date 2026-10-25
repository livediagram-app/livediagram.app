import { comparisonPath } from '../catalogue';
import { ArrowRightIcon, CheckIcon } from '../icons';
import { lookOf } from '../looks';
import type { Alternative } from '../types';
import type { Mark } from './mark';
import { VsBadge } from './VsBadge';

// A link card to one comparison: the hub's grid and the "Other comparisons" row under each page. A
// tinted header panel in the competitor's tone carries the vs tiles on a dot grid; below it the
// page's h1, its description, and the comparison's three highlight chips.
export function AlternativeCard({ alt, mark }: { alt: Alternative; mark: Mark }) {
  const look = lookOf(alt.slug);
  return (
    <a
      href={comparisonPath(alt.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
    >
      <span
        className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${look.panel}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(rgb(15_23_42/0.08)_1px,transparent_1px)] [background-size:14px_14px] dark:[background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)]"
        />
        <span className="relative transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <VsBadge slug={alt.slug} mark={mark} size="sm" />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-6">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          vs {alt.name}
        </span>
        <span className="mt-2 block text-lg leading-snug font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {alt.h1}
        </span>
        <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {alt.description}
        </span>
        <span className="mt-4 flex flex-wrap gap-1.5">
          {alt.highlights.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="text-brand-700 dark:text-brand-300">
                <CheckIcon size={12} />
              </span>
              {chip}
            </span>
          ))}
        </span>
        <span className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-slate-900 dark:text-slate-100">
          Read the comparison
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-brand-700 group-hover:text-white motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-brand-600">
            <ArrowRightIcon />
          </span>
        </span>
      </span>
    </a>
  );
}
