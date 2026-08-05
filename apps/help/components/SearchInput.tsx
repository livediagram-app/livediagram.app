'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { articleHref, searchArticles } from '@/lib/articles';
import { reportHelpSearch, SEARCH_SETTLE_MS } from '@/lib/search-telemetry';

// Below this many characters a query is treated as too short to search.
const MIN_QUERY = 2;

export function SearchInput({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState('');
  // The dropdown is open whenever the query is long enough, unless the user
  // has explicitly dismissed it by clicking away. Tracking the dismissal
  // rather than the openness keeps `results` and `isOpen` derived from
  // `query` instead of copied into state by an effect, which is what made
  // every keystroke cost two renders.
  const [dismissed, setDismissed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_QUERY;
  const results = useMemo(() => (hasQuery ? searchArticles(query) : []), [hasQuery, query]);
  const isOpen = hasQuery && !dismissed;

  // Report the SETTLED query's outcome, not every keystroke (spec/22). The
  // timer restarts on each change, so only the query the reader stopped on is
  // counted, and the emitter dedupes repeats of it.
  useEffect(() => {
    if (!hasQuery) return;
    const timer = setTimeout(() => reportHelpSearch(trimmed, results.length), SEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hasQuery, trimmed, results.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full text-left">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          xmlns="http://www.w3.org/2000/svg"
          width={large ? 22 : 18}
          height={large ? 22 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search help articles..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDismissed(false);
          }}
          onFocus={() => setDismissed(false)}
          aria-label="Search help articles"
          className={`w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 ${
            large ? 'py-4 pl-12 pr-4 text-lg' : 'py-2.5 pl-10 pr-4 text-sm'
          }`}
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="scrollbar-thin absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((article) => (
            <Link
              key={`${article.categorySlug}/${article.slug}`}
              href={articleHref(article)}
              onClick={() => {
                setQuery('');
                setDismissed(false);
              }}
              className="block border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-brand-50/60"
            >
              <p className="text-sm font-medium text-slate-900">{article.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {article.category} &middot; {article.description}
              </p>
            </Link>
          ))}
        </div>
      )}
      {isOpen && query.trim().length > 1 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="text-center text-sm text-slate-500">
            No articles found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
