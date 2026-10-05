'use client';

import { useRef } from 'react';
import type { CommunityFacetsResponse } from '@livediagram/api-schema';
import {
  CheckIcon,
  ChevronDownIcon,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';

// The tag filter inside the search box's right edge (docs/specs/025-community/community.md "Gallery"):
// the most used tags, each a checkable row. Choosing one adds its `#tag` to the search and choosing it
// again takes it out, so the search box always shows every filter in words. A menu button over the
// shared menu keyboard, like the sort menu; the menu stays open so several tags can be picked in turn.
export function TagFilter({
  facets,
  selected,
  onToggle,
}: {
  facets: CommunityFacetsResponse | null;
  // The tags the search currently asks for.
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, menu.close, menu.open);
  const popular = facets?.tags ?? [];
  // A tag asked for by a link but no longer popular still shows, checked, so it can be taken out.
  const rows = [
    ...selected
      .filter((t) => !popular.some((p) => p.tag === t))
      .map((tag) => ({ tag, count: null })),
    ...popular.map(({ tag, count }) => ({ tag, count: count as number | null })),
  ];
  if (rows.length === 0) return null;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        {...menu.triggerProps}
        aria-label={selected.length ? `Tags, ${selected.length} chosen` : 'Filter by tag'}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${
          selected.length
            ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <span aria-hidden className="font-semibold">
          #
        </span>
        <span>Tags</span>
        {selected.length ? (
          <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold leading-4 text-white">
            {selected.length}
          </span>
        ) : null}
        <ChevronDownIcon
          aria-hidden
          size={12}
          className={`transition-transform duration-micro motion-reduce:transition-none ${menu.open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu.open ? (
        <TagOptions
          rows={rows}
          selected={selected}
          trigger={menu.trigger}
          initialFocus={menu.initialFocus}
          onClose={menu.close}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  );
}

function TagOptions({
  rows,
  selected,
  trigger,
  initialFocus,
  onClose,
  onToggle,
}: {
  rows: { tag: string; count: number | null }[];
  selected: string[];
  trigger: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  onClose: () => void;
  onToggle: (tag: string) => void;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label: 'Tags' });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute right-0 top-full z-(--z-popover) w-60 pt-2 outline-none"
    >
      <div className="flex max-h-80 animate-fade-in flex-col gap-px overflow-y-auto rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60">
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Popular Tags
        </p>
        {rows.map(({ tag, count }) => {
          const checked = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              tabIndex={-1}
              onClick={() => onToggle(tag)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
                checked
                  ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex-1 truncate">#{tag}</span>
              {count !== null ? (
                <span className="text-xs tabular-nums text-slate-400">{count}</span>
              ) : null}
              <span className="flex w-4 shrink-0 justify-end">
                {checked ? <CheckIcon aria-hidden /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
