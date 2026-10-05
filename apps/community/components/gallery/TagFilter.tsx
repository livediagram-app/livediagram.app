'use client';

import { useRef } from 'react';
import type { CommunityFacetsResponse } from '@livediagram/api-schema';
import {
  CheckIcon,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
  MENU_PANEL,
  menuRadioRowClass,
} from '@livediagram/ui';
import { HashIcon } from '../shared/icons';
import { SearchControlButton } from './SearchControlButton';

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
      <SearchControlButton
        {...menu.triggerProps}
        aria-label={selected.length ? `Tags, ${selected.length} chosen` : 'Filter by tag'}
        icon={<HashIcon />}
        label="Tags"
        active={selected.length > 0}
        badge={selected.length}
        open={menu.open}
      />
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
      <div className={`${MENU_PANEL} max-h-80 overflow-y-auto`}>
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
              className={menuRadioRowClass(checked, { weight: 'checked' })}
            >
              <span className="flex-1 truncate">#{tag}</span>
              {count !== null ? (
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {count}
                </span>
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
