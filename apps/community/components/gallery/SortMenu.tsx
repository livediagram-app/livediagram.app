'use client';

import { useRef } from 'react';
import { COMMUNITY_SORTS, type CommunitySort } from '@livediagram/api-schema';
import {
  CheckIcon,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { SortIcon } from '../shared/icons';
import { SearchControlButton } from './SearchControlButton';

// The sort control inside the search box's right edge (docs/specs/025-community/community.md
// "Gallery": Newest, Most Loved, Most Copied). The choice is written into the search as a `sort:` token
// by the search box. A menu button over the shared menu keyboard (blueprint §10;
// docs/specs/004-interface-design/menus.md): arrows move, Enter chooses, Escape closes and focus
// returns to the trigger.
export function SortMenu({
  value,
  onChange,
}: {
  value: CommunitySort;
  onChange: (next: CommunitySort) => void;
}) {
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, menu.close, menu.open);
  const current = COMMUNITY_SORTS.find((s) => s.id === value) ?? COMMUNITY_SORTS[0];
  return (
    <div ref={root} className="relative">
      <SearchControlButton
        {...menu.triggerProps}
        aria-label={`Sort: ${current.label}`}
        icon={<SortIcon />}
        label={current.label}
        active={value !== 'new'}
        open={menu.open}
      />
      {menu.open ? (
        <SortOptions
          value={value}
          trigger={menu.trigger}
          initialFocus={menu.initialFocus}
          onClose={menu.close}
          onChoose={(next) => {
            menu.close();
            if (next !== value) onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function SortOptions({
  value,
  trigger,
  initialFocus,
  onClose,
  onChoose,
}: {
  value: CommunitySort;
  trigger: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  onClose: () => void;
  onChoose: (next: CommunitySort) => void;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label: 'Sort' });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute right-0 top-full z-(--z-popover) min-w-44 pt-2 outline-none"
    >
      <div className="flex animate-fade-in flex-col gap-px rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60">
        {COMMUNITY_SORTS.map((sort) => {
          const checked = sort.id === value;
          return (
            <button
              key={sort.id}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              tabIndex={-1}
              onClick={() => onChoose(sort.id)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
                checked
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex-1">{sort.label}</span>
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
