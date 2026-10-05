'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  COMMUNITY_SEARCH_MAX,
  communitySearchCategory,
  communitySearchMine,
  communitySearchSort,
  setCommunitySearchMine,
  setCommunitySearchCategory,
  communitySearchTags,
  setCommunitySearchSort,
  toggleCommunitySearchTag,
  type CommunityCategory,
  type CommunityFacetsResponse,
  type CommunitySort,
} from '@livediagram/api-schema';
import { CloseIcon, SearchIcon } from '@livediagram/ui';
import { SEARCH_DEBOUNCE_MS } from '@/lib/config';
import { searchEcho } from '@/lib/query-state';
import { MineIcon } from '../shared/icons';
import { CategoryMenu } from './CategoryMenu';
import { SearchControlButton } from './SearchControlButton';
import { SortMenu } from './SortMenu';
import { TagFilter } from './TagFilter';

// Search across titles, descriptions and tags (docs/specs/025-community/community.md "Gallery";
// blueprint §5, §10): a `role="search"` form with a visually hidden label. Typing filters 300 ms after
// the last keystroke; Enter filters at once. The draft follows `value` when it changes from outside
// (Clear Filters, a tag link). The category, tag and sort controls sit inside the box's right edge: a
// chosen category is written into the search as `category:<id>`, a tag as `#tag` and a sort as
// `sort:<id>` (All and Newest need none), each applied at once, so the box always reads as the whole
// query. My Shares, where sign-in exists, toggles `is:mine`: only your own posts. On phones the controls
// show their icons only.
export function SearchBox({
  value,
  onSearch,
  facets,
  onTagChosen,
  onSortChosen,
  onCategoryChosen,
  mineAvailable = false,
  onMineChosen,
}: {
  value: string;
  onSearch: (q: string) => void;
  facets: CommunityFacetsResponse | null;
  // Told when a tag is added from the filter, for telemetry.
  onTagChosen?: () => void;
  // Told when a sort is chosen, for telemetry.
  onSortChosen?: () => void;
  // Told when a category is chosen, for telemetry.
  onCategoryChosen?: () => void;
  // Whether this build has sign-in, so My Shares can be offered.
  mineAvailable?: boolean;
  // Told when My Shares is turned on, for telemetry.
  onMineChosen?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    // Only a change made elsewhere replaces the draft; the echo of what is being typed leaves it as typed.
    if (value !== searchEcho(draft)) setDraft(value);
  }

  // Debounce: commit the settled draft. An effect, because it schedules work against the clock.
  useEffect(() => {
    const q = draft.trim();
    if (searchEcho(q) === value) return;
    const timer = window.setTimeout(() => onSearch(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onSearch, value]);

  const toggleTag = (tag: string) => {
    const adding = !communitySearchTags(draft).includes(tag);
    const next = toggleCommunitySearchTag(draft, tag);
    setDraft(next);
    onSearch(next.trim());
    if (adding) onTagChosen?.();
  };

  const chooseCategory = (category: CommunityCategory | null) => {
    const next = setCommunitySearchCategory(draft, category);
    setDraft(next);
    onSearch(next.trim());
    if (category) onCategoryChosen?.();
  };

  const chooseSort = (sort: CommunitySort) => {
    const next = setCommunitySearchSort(draft, sort);
    setDraft(next);
    onSearch(next.trim());
    onSortChosen?.();
  };

  const mine = communitySearchMine(draft);
  const toggleMine = () => {
    const next = setCommunitySearchMine(draft, !mine);
    setDraft(next);
    onSearch(next.trim());
    if (!mine) onMineChosen?.();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q !== value) onSearch(q);
  };

  return (
    // Lifted above the grid, below the sticky header: the controls inside sit in a transformed (stacking)
    // wrapper, so without this their menus would open behind the cards.
    <form role="search" onSubmit={submit} className="relative z-(--z-toolbar) w-full">
      <label htmlFor={id} className="sr-only">
        Search the Community
      </label>
      <SearchIcon
        size={18}
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search documents, or #tags..."
        autoComplete="off"
        maxLength={COMMUNITY_SEARCH_MAX}
        spellCheck={false}
        enterKeyHint="search"
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-[31rem] text-[15px] max-sm:pr-44 text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors duration-micro focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {draft ? (
          <button
            type="button"
            aria-label="Clear Search"
            onClick={() => {
              setDraft('');
              onSearch('');
            }}
            className="rounded-md p-1.5 text-slate-400 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={14} aria-hidden />
          </button>
        ) : null}
        {mineAvailable || mine ? (
          <SearchControlButton
            icon={<MineIcon />}
            label="My Shares"
            aria-label="My Shares"
            aria-pressed={mine}
            active={mine}
            chevron={false}
            onClick={toggleMine}
          />
        ) : null}
        <CategoryMenu
          value={communitySearchCategory(draft)}
          facets={facets}
          onChange={chooseCategory}
        />
        <TagFilter facets={facets} selected={communitySearchTags(draft)} onToggle={toggleTag} />
        <SortMenu value={communitySearchSort(draft) ?? 'new'} onChange={chooseSort} />
      </div>
    </form>
  );
}
