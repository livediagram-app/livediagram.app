'use client';

// The Explorer's search field: what the person types becomes the Search view 250 ms after they stop, so
// the index is asked once per pause rather than once per key (and the list cancels a superseded request).
// Escape clears it.

import { useEffect, useRef, useState } from 'react';
import { SearchIcon } from '../ui/icons';
import { useExplorer } from './context';

export const SEARCH_DEBOUNCE_MS = 250;

export function SearchField({ className }: { className?: string }) {
  const { view, navigate, words } = useExplorer();
  const current = view.kind === 'search' ? view.q : '';
  const [text, setText] = useState(current);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // A view change from elsewhere (the sidebar) shows in the field.
  useEffect(() => {
    setText((t) => (t.trim() === current ? t : current));
  }, [current]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const change = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      navigateRef.current({ kind: 'search', q: next.trim() });
    }, SEARCH_DEBOUNCE_MS);
  };

  return (
    <label
      className={`flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 ${className ?? ''}`}
    >
      <span className="shrink-0 text-slate-400">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault();
            change('');
          }
        }}
        placeholder={`Search ${words.lowerMany}, tags and folders`}
        aria-label="Search"
        className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
      />
    </label>
  );
}
