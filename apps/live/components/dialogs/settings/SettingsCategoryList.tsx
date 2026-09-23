'use client';

import type { SettingsCategorySpec } from './settings-catalogue';
import { NavChevron } from '@/components/primitives/NavChevron';
import { SettingsCategoryIcon } from './settings-icons';

// The category list, in both of its jobs: the ROOT SCREEN on a phone (tap a
// row to push its pane) and the SIDEBAR on desktop (click a row to swap the
// pane beside it). One component for both because the row is the same row ,
// only the chevron and the selected highlight differ, and splitting it would
// be how the two drift apart.
export function SettingsCategoryList({
  categories,
  selected,
  onSelect,
  variant,
  searching,
}: {
  categories: (SettingsCategorySpec & { matchCount?: number })[];
  // Which row reads as current. Always null on the phone root screen: nothing
  // is "selected" there, you are choosing where to go.
  selected: string | null;
  onSelect: (id: SettingsCategorySpec['id']) => void;
  // 'root' = the phone's first screen (chevrons, grouped card).
  // 'sidebar' = the desktop rail beside the pane (highlight, no chevrons).
  variant: 'root' | 'sidebar';
  // While searching, each row shows how many of its settings match, and a
  // category with none is dimmed and unclickable: the badge is the answer to
  // "which category was it in?", which is the question search is really for.
  searching?: boolean;
}) {
  const isRoot = variant === 'root';
  return (
    <nav
      aria-label="Settings categories"
      className={
        isRoot
          ? 'flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700'
          : 'flex flex-col gap-0.5 p-2'
      }
    >
      {categories.map((category) => {
        const current = selected === category.id;
        const count = category.matchCount ?? 0;
        const empty = searching === true && count === 0;
        return (
          <button
            key={category.id}
            type="button"
            disabled={empty}
            onClick={() => onSelect(category.id)}
            // The sidebar is a set of alternatives with one current, which is
            // what aria-current names. The root list is navigation, so its
            // rows make no such claim.
            aria-current={!isRoot && current ? 'page' : undefined}
            className={`flex items-center gap-3 text-left transition ${
              empty ? 'cursor-default opacity-40' : ''
            } ${
              isRoot
                ? 'px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                : `rounded-lg px-2.5 py-2 ${
                    current
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
            }`}
          >
            <SettingsCategoryIcon id={category.id} />
            <span
              className={`flex-1 truncate text-sm font-medium ${
                !isRoot && current
                  ? 'text-brand-800 dark:text-brand-100'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {category.label}
            </span>
            {/* Only the phone root screen gets a chevron: it is the one that
                actually goes somewhere. On the sidebar the pane is already
                on screen, so a "there's more this way" arrow would lie. */}
            {searching && count > 0 ? (
              <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
                {count}
              </span>
            ) : null}
            {isRoot ? <NavChevron className="text-slate-400 dark:text-slate-500" /> : null}
          </button>
        );
      })}
    </nav>
  );
}
