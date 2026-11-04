'use client';

// A page's Appearance sheet on a phone (livedocuments and livedesign pages-mode.md "Beside the cog"): the page's look
// controls as one list of rows, each its icon, its name and a short line, a 44 px touch target. A press hands the
// row's id back; the editor closes this sheet and opens that control's own. Shared so every editor's reads the same.
import type { ReactNode } from 'react';
import { lucideChevronRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

const ChevronIcon = lucideGlyph(lucideChevronRight, 14);

export type AppearanceRowItem<Id extends string> = {
  id: Id;
  name: string;
  line: string;
  icon: ReactNode;
};

export function AppearanceRowList<Id extends string>({
  rows,
  onPick,
}: {
  rows: readonly AppearanceRowItem<Id>[];
  onPick: (id: Id) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
      {rows.map(({ id, name, line, icon }) => (
        <li key={id}>
          <button
            type="button"
            data-appearance-row={id}
            onClick={() => onPick(id)}
            className="group flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/60"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {name}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">{line}</span>
            </span>
            <span
              aria-hidden
              className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
            >
              <ChevronIcon />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
