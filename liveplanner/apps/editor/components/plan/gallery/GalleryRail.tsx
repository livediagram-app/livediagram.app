'use client';

// A gallery's rail (docs/specs/026-plan/board-widgets.md "The rail", item-types.md "Fields and Tabs": Add Field), shared
// by Add a Widget and Add Field: its entries down the left, each with its icon, its name and how many it holds, in
// groups (a later group under its own small heading). The current entry is marked; an entry holding nothing is dimmed.
// In a gallery under 600 px wide the rail is a row of chips over the list (the container query on the gallery's box).
// What pressing an entry does is the gallery's: Add a Widget scrolls to its section, Add Field shows that category.
import type { ReactNode } from 'react';
import { CountBadge } from '@liveplanner/ui';

export type RailEntry = { key: string; title: string; icon: ReactNode; count: number };

export type RailGroup = { heading?: string; entries: readonly RailEntry[] };

export function GalleryRail({
  label,
  groups,
  current,
  onPick,
  className = '',
}: {
  // The rail's accessible name ("Widget sections").
  label: string;
  groups: readonly RailGroup[];
  current: string | null;
  onPick: (key: string) => void;
  className?: string;
}) {
  const entry = (e: RailEntry) => {
    const on = e.key === current;
    return (
      <li key={e.key} className="shrink-0">
        <button
          type="button"
          aria-current={on ? 'true' : undefined}
          data-rail-entry={e.key}
          onClick={() => onPick(e.key)}
          className={`flex w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none pointer-coarse:min-h-11 @max-[600px]:rounded-full @max-[600px]:border @max-[600px]:py-1 ${
            on
              ? 'bg-brand-50 text-brand-800 @max-[600px]:border-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:@max-[600px]:border-brand-500/50'
              : `text-slate-600 hover:bg-slate-100 @max-[600px]:border-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:@max-[600px]:border-slate-700 ${
                  e.count === 0 ? 'opacity-55' : ''
                }`
          }`}
        >
          <span
            aria-hidden
            className={`flex shrink-0 [&_svg]:size-3.5 ${on ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}
          >
            {e.icon}
          </span>
          <span className="min-w-0 flex-1 truncate">{e.title}</span>
          {e.count > 0 ? <CountBadge count={e.count} /> : null}
        </button>
      </li>
    );
  };
  return (
    <nav
      aria-label={label}
      className={`flex shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-r border-slate-100 p-2 dark:border-slate-800 @max-[600px]:flex-row @max-[600px]:overflow-x-auto @max-[600px]:overflow-y-hidden @max-[600px]:border-b @max-[600px]:border-r-0 @max-[600px]:px-3 @min-[601px]:w-56 [scrollbar-width:thin] ${className}`}
    >
      {groups.map((g, i) =>
        g.entries.length === 0 ? null : (
          <div key={g.heading ?? i} className="contents">
            {g.heading ? (
              <h4 className="mt-3 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 @max-[600px]:sr-only">
                {g.heading}
              </h4>
            ) : null}
            <ul
              className={`flex flex-col gap-0.5 @max-[600px]:flex-row @max-[600px]:gap-1.5 ${i > 0 ? '@max-[600px]:ml-1.5' : ''}`}
            >
              {g.entries.map(entry)}
            </ul>
          </div>
        ),
      )}
    </nav>
  );
}
