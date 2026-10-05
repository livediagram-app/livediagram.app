'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { CloseIcon, SearchIcon } from '@livediagram/ui';
import { SEARCH_DEBOUNCE_MS } from '@/lib/config';

// Search across titles, descriptions and tags (docs/specs/025-community/community.md "Gallery";
// blueprint §5, §10): a `role="search"` form with a visually hidden label. Typing filters 300 ms after
// the last keystroke; Enter filters at once. The draft follows `value` when it changes from outside
// (Clear Filters).
export function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q !== value) onSearch(q);
  };

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
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
        placeholder="Search boards, ideas and tags..."
        autoComplete="off"
        enterKeyHint="search"
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-[15px] text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors duration-micro focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear Search"
          onClick={() => {
            setDraft('');
            onSearch('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={14} aria-hidden />
        </button>
      ) : null}
    </form>
  );
}
