'use client';

// On This Page (the right rail): how long the page takes to read, then the headings of its writing, the one being
// read marked as the page scrolls, each a press that brings its heading into view. Absent for an empty page; a page
// with writing and no headings shows its reading time alone.
import type { PageHeading } from '@/lib/knowledge/page-headings';

const INDENT: Record<PageHeading['level'], string> = { 1: 'pl-3', 2: 'pl-6', 3: 'pl-9' };

export function OnThisPage({
  headings,
  current,
  onGo,
  minutes = 0,
}: {
  headings: readonly PageHeading[];
  current: string | undefined;
  onGo: (id: string) => void;
  /** Whole minutes the page takes to read; 0 for an empty page. */
  minutes?: number;
}) {
  const readTime =
    minutes > 0 ? (
      <span
        data-reading-time=""
        className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400"
      >
        {minutes} min read
      </span>
    ) : null;
  if (headings.length === 0) return readTime ? <div>{readTime}</div> : null;
  return (
    <nav aria-label="On This Page" data-on-this-page="">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          On This Page
        </p>
        {readTime}
      </div>
      <ul className="mt-2 border-l-2 border-slate-200 dark:border-slate-800">
        {headings.map((heading) => {
          const here = heading.id === current;
          return (
            <li key={heading.id}>
              <button
                type="button"
                aria-current={here ? 'location' : undefined}
                onClick={() => onGo(heading.id)}
                // The 2px rule on the list is the rest state; the current heading draws the brand colour over it.
                className={`-ml-0.5 block w-[calc(100%+2px)] cursor-pointer truncate border-l-2 py-1 pr-2 text-left text-[13px] leading-5 motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 phone:py-3 ${INDENT[heading.level]} ${
                  here
                    ? 'border-brand-600 font-medium text-slate-900 dark:border-brand-400 dark:text-slate-100'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {heading.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
