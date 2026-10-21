'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SearchIcon, useClickOutside } from '@livediagram/ui';
import { articleHref } from '@livediagram/help-registry/hrefs';
import type { Article } from '@/lib/articles';
import { reportHelpSearch, SEARCH_SETTLE_MS } from '@/lib/search-telemetry';

// Below this many characters a query is treated as too short to search.
const MIN_QUERY = 2;

type Search = (query: string) => Article[];

// The search runs over the whole article registry (about 300 articles with their descriptions
// and keywords), which every help page would otherwise download to show a search box. It loads
// on the reader's first focus or keystroke instead, well before a query is long enough to search.
let searchModule: Promise<Search> | null = null;
function loadSearch(): Promise<Search> {
  searchModule ??= import('@/lib/articles').then(
    (m) => m.searchArticles,
    (err: unknown) => {
      searchModule = null;
      throw err;
    },
  );
  return searchModule;
}

export function SearchInput({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState('');
  // The dropdown is open whenever the query is long enough, unless the user
  // has explicitly dismissed it by clicking away. Tracking the dismissal
  // rather than the openness keeps `results` and `isOpen` derived from
  // `query` instead of copied into state by an effect, which is what made
  // every keystroke cost two renders.
  const [dismissed, setDismissed] = useState(false);
  const [search, setSearch] = useState<Search | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prepareSearch = () => {
    if (search) return;
    loadSearch().then(
      (fn) => setSearch(() => fn),
      (err: unknown) =>
        console.warn('[help-search] search unavailable; retrying on next focus', err),
    );
  };

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_QUERY;
  const results = useMemo(
    () => (hasQuery && search ? search(query) : []),
    [hasQuery, query, search],
  );
  // Until the search has loaded there is no answer yet, so neither results nor "No articles found".
  const isOpen = hasQuery && !dismissed && search !== null;

  // Report the SETTLED query's outcome, not every keystroke (docs/specs/017-telemetry/telemetry.md). The
  // timer restarts on each change, so only the query the reader stopped on is
  // counted, and the emitter dedupes repeats of it.
  useEffect(() => {
    if (!hasQuery || !search) return;
    const timer = setTimeout(() => reportHelpSearch(trimmed, results.length), SEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hasQuery, search, trimmed, results.length]);

  // A press outside dismisses the open dropdown. Only listening while it's
  // open is equivalent: typing or focusing clears `dismissed` anyway.
  useClickOutside(wrapperRef, () => setDismissed(true), isOpen);

  // `/` searches from anywhere on the page (docs/specs/018-help/help-pages.md "Search"), unless the reader is
  // already typing somewhere. A page with the large search box gives it the key; the header's box takes it
  // everywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!large && document.querySelector('[data-help-search="large"]')) return;
      const input = inputRef.current;
      // The header's box is hidden on a phone; a hidden box never takes the key.
      if (!input || input.offsetParent === null) return;
      e.preventDefault();
      input.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [large]);

  return (
    <div ref={wrapperRef} className="relative w-full text-left">
      <div className="relative">
        <SearchIcon
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={large ? 22 : 18}
        />
        <input
          ref={inputRef}
          data-help-search={large ? 'large' : 'header'}
          type="text"
          placeholder="Search help articles..."
          value={query}
          onChange={(e) => {
            prepareSearch();
            setQuery(e.target.value);
            setDismissed(false);
          }}
          onFocus={() => {
            prepareSearch();
            setDismissed(false);
          }}
          onPointerEnter={prepareSearch}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            if (isOpen) setDismissed(true);
            else e.currentTarget.blur();
          }}
          aria-label="Search help articles"
          aria-keyshortcuts="/"
          className={`w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-micro focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
            large ? 'py-4 pl-12 pr-12 text-lg' : 'py-2.5 pl-10 pr-10 text-sm'
          }`}
        />
        {query === '' && (
          <kbd
            aria-hidden
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md border pointer-coarse:hidden border-slate-200 bg-slate-50 font-sans font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 ${
              large ? 'right-4 px-2 py-0.5 text-sm' : 'right-3 px-1.5 text-xs'
            }`}
          >
            /
          </kbd>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div
          role="region"
          aria-label="Search results"
          className="scrollbar-slim absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          {results.map((article) => (
            <Link
              key={`${article.categorySlug}/${article.slug}`}
              href={articleHref(article)}
              onClick={() => {
                setQuery('');
                setDismissed(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-brand-50/60 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                {article.category}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                {article.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {article.description}
              </p>
            </Link>
          ))}
        </div>
      )}
      {/* What the dropdown holds, said to a screen reader: the results appear below the field with nothing else to
          announce them (docs/specs/018-help/help-pages.md "Search"). */}
      <p aria-live="polite" className="sr-only">
        {isOpen
          ? results.length === 0
            ? `No articles found for ${trimmed}`
            : `${results.length} ${results.length === 1 ? 'article' : 'articles'} found`
          : ''}
      </p>
      {isOpen && query.trim().length > 1 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No articles found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
