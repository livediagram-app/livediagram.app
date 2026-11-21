'use client';

// On This Page (the right rail): the headings of its writing, the one being read marked as the page scrolls, each a
// press that brings its heading into view. Absent for a page with no headings. (The reading time is under the title,
// in the meta row: PageMetaRow.)
import type { PageHeading } from '@/lib/knowledge/page-headings';
import { RAIL_LABEL } from './PageHealthCard';

const INDENT: Record<PageHeading['level'], string> = { 1: 'pl-3', 2: 'pl-6', 3: 'pl-9' };

export function OnThisPage({
  headings,
  current,
  onGo,
}: {
  headings: readonly PageHeading[];
  current: string | undefined;
  onGo: (id: string) => void;
}) {
  if (headings.length === 0) return null;
  return (
    <nav aria-label="On This Page" data-on-this-page="">
      <p className={RAIL_LABEL}>On This Page</p>
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
