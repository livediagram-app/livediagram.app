import { lucideArrowRight, lucideCheck } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';
import { VsBadge } from '@/components/compare/VsBadge';
import type { Alternative } from '@/lib/alternatives';

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);
const CheckIcon = lucideGlyph(lucideCheck, 12);

// A link card to one comparison page: the comparison hub's grid and the "Other comparisons" row under each page.
// A tinted header panel carries the vs tiles on a dot grid; below it the page's h1, its description, and the
// competitor's three highlight chips (competitor-look.ts).
export function AlternativeCard({ alt }: { alt: Alternative }) {
  const look = COMPETITOR_LOOK[alt.slug];
  return (
    <a
      href={`/alternatives/${alt.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <span
        className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${look?.panel ?? 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900'}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(rgb(15_23_42/0.08)_1px,transparent_1px)] [background-size:14px_14px] dark:[background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)]"
        />
        <span className="relative transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <VsBadge slug={alt.slug} size="sm" />
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
        {look && (
          <span className="mt-4 flex flex-wrap gap-1.5">
            {look.highlights.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="text-brand-600 dark:text-brand-300">
                  <CheckIcon />
                </span>
                {chip}
              </span>
            ))}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between pt-6 text-sm font-medium text-slate-900 dark:text-slate-100">
          Read the comparison
          <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-brand-700 group-hover:text-white motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-brand-600">
            <ArrowIcon />
          </span>
        </span>
      </span>
    </a>
  );
}
