'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  communitySearchSort,
  communitySearchTags,
  setCommunitySearchSort,
  toggleCommunitySearchTag,
  type CommunityFacetsResponse,
  type CommunitySort,
} from '@livediagram/api-schema';
import { CloseIcon, SearchIcon } from '@livediagram/ui';
import { SEARCH_DEBOUNCE_MS } from '@/lib/config';
import { SortMenu } from './SortMenu';
import { TagFilter } from './TagFilter';

// Search across titles, descriptions and tags (docs/specs/025-community/community.md "Gallery";
// blueprint §5, §10): a `role="search"` form with a visually hidden label. Typing filters 300 ms after
// the last keystroke; Enter filters at once. The draft follows `value` when it changes from outside
// (Clear Filters, a tag link). The tag filter and the sort sit inside the box's right edge: a chosen tag
// is written into the search as `#tag` and a chosen sort as `sort:<id>` (Newest needs none), each
// applied at once, so the box always reads as the whole query.
export function SearchBox({
  value,
  onSearch,
  facets,
  onTagChosen,
  onSortChosen,
}: {
  value: string;
  onSearch: (q: string) => void;
  facets: CommunityFacetsResponse | null;
  // Told when a tag is added from the filter, for telemetry.
  onTagChosen?: () => void;
  // Told when a sort is chosen, for telemetry.
  onSortChosen?: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  // Debounce: commit the settled draft. An effect, because it schedules work against the clock.
  useEffect(() => {
    const q = draft.trim();
    if (q === value) return;
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

  const chooseSort = (sort: CommunitySort) => {
    const next = setCommunitySearchSort(draft, sort);
    setDraft(next);
    onSearch(next.trim());
    onSortChosen?.();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q !== value) onSearch(q);
  };

  return (
    // Lifted above the grid: the controls inside sit in a transformed (stacking) wrapper, so without
    // this the tag menu would open behind the cards.
    <form role="search" onSubmit={submit} className="relative z-(--z-popover) w-full">
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
        placeholder="Search boards, or #tags..."
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-60 text-[15px] max-sm:pr-40 text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors duration-micro focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
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
        <TagFilter facets={facets} selected={communitySearchTags(draft)} onToggle={toggleTag} />
        <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <SortMenu value={communitySearchSort(draft) ?? 'new'} onChange={chooseSort} />
      </div>
    </form>
  );
}
