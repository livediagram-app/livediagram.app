'use client';

import { useRef } from 'react';
import {
  COMMUNITY_CATEGORIES,
  communityCategoryLabel,
  type CommunityCategory,
  type CommunityFacetsResponse,
} from '@livediagram/api-schema';
import {
  CheckIcon,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { CategoryIcon } from '../shared/icons';
import { SearchControlButton } from './SearchControlButton';

// The category control inside the search box (docs/specs/025-community/community.md "Gallery"): All,
// then each category with its count of documents. Choosing one is written into the search as
// `category:<id>` by the search box; All takes it out. Once the counts are known an empty category is
// left out (unless it is the one chosen), so every row leads somewhere. A menu button over the shared
// menu keyboard, like the sort menu.
export function CategoryMenu({
  value,
  facets,
  onChange,
}: {
  value: CommunityCategory | null;
  facets: CommunityFacetsResponse | null;
  onChange: (next: CommunityCategory | null) => void;
}) {
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, menu.close, menu.open);
  const label = value ? communityCategoryLabel(value) : 'Category';
  return (
    <div ref={root} className="relative">
      <SearchControlButton
        {...menu.triggerProps}
        aria-label={value ? `Category: ${label}` : 'Filter by category'}
        icon={<CategoryIcon />}
        label={label}
        active={value !== null}
        open={menu.open}
      />
      {menu.open ? (
        <CategoryOptions
          value={value}
          facets={facets}
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

function CategoryOptions({
  value,
  facets,
  trigger,
  initialFocus,
  onClose,
  onChoose,
}: {
  value: CommunityCategory | null;
  facets: CommunityFacetsResponse | null;
  trigger: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  onClose: () => void;
  onChoose: (next: CommunityCategory | null) => void;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label: 'Category' });
  const rows: { id: CommunityCategory | null; label: string; count: number | undefined }[] = [
    { id: null, label: 'All Categories', count: facets?.total },
    ...COMMUNITY_CATEGORIES.filter(
      (c) => !facets || (facets.categories[c.id] ?? 0) > 0 || c.id === value,
    ).map((c) => ({ id: c.id, label: c.label, count: facets?.categories[c.id] ?? undefined })),
  ];
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute right-0 top-full z-(--z-popover) w-64 pt-2 outline-none"
    >
      <div className="flex max-h-80 animate-fade-in flex-col gap-px overflow-y-auto rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60">
        {rows.map((row) => {
          const checked = row.id === value;
          return (
            <button
              key={row.id ?? 'all'}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              tabIndex={-1}
              onClick={() => onChoose(row.id)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
                checked
                  ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex-1 truncate">{row.label}</span>
              {row.count !== undefined ? (
                <span className="text-xs tabular-nums text-slate-400">{row.count}</span>
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
