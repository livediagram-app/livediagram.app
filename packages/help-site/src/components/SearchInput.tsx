'use client';

import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useClickOutside } from '@liveworkspace/ui';
import type { HelpScope, SearchEntry } from '@liveworkspace/help-registry';
import { articleHref, scopeHref, withQuery } from '@liveworkspace/help-registry/hrefs';
import { useHelpClient, type HelpSearch } from '../client';
import { groupResults } from '../lib/search-groups';
import { arrivalQuery, locationWithQuery, setSearchQuery } from '../lib/search-query';
import { reportHelpSearch, SEARCH_SETTLE_MS } from '../lib/search-telemetry';
import { AppMarkRow } from './AppMarks';
import { AppSwitch } from './AppSwitch';
import { useSiteHref } from './SiteLink';
import { SearchIcon } from './chrome-icons';

// Below this many characters a query is treated as too short to search.
const MIN_QUERY = 2;

type Search = HelpSearch;

// The search runs over an index of articles with their descriptions and keywords, which every help page would
// otherwise download to show a search box. It loads on the reader's first focus or keystroke instead, well before a
// query is long enough to search: the scope's own index first (liveworkspace/docs/specs/016-help/help-centre.md
// "Search"), and in an app's help the every-app index only once the scope's results show, for "From Other Apps".
// Each first load is kept, or dropped on failure so the next try loads again.
const searches = new Map<() => Promise<Search>, Promise<Search>>();
function loadSearch(load: () => Promise<Search>): Promise<Search> {
  let loading = searches.get(load);
  if (!loading) {
    loading = load().catch((err: unknown) => {
      searches.delete(load);
      throw err;
    });
    searches.set(load, loading);
  }
  return loading;
}

/** A result's link: on its own page's address when it applies to the scope (or under All Apps), else on the
 *  article's canonical address, so a "From other apps" row opens where that article lives. */
function resultHref(article: SearchEntry, scope: HelpScope | undefined, here: boolean): string {
  if (!scope || here) return articleHref(article);
  return articleHref(article, article.apps.length === 1 ? article.apps[0]! : 'all');
}

const noSubscription = () => () => {};

export function SearchInput({ large = false }: { large?: boolean }) {
  const client = useHelpClient();
  const scope = client.facts.scope;
  const siteHref = useSiteHref();
  // A page opened with `?q=` (from the app switch or Search All Apps instead) shows that search at once in its main
  // box: the large one where the page has one, else the header's. Until the reader types, the box holds it.
  const arrived = useSyncExternalStore(
    noSubscription,
    () =>
      scope && (large || !document.querySelector('[data-help-search="large"]'))
        ? arrivalQuery()
        : '',
    () => '',
  );
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? arrived;
  // The box's text is published for the app switch, whose links carry it (help-centre.md "A search survives the
  // move").
  const setQuery = (next: string) => {
    setTyped(next);
    if (scope) setSearchQuery(next);
  };
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
    loadSearch(client.loadSearch).then(
      (fn) => setSearch(() => fn),
      (err: unknown) =>
        console.warn('[help-search] search unavailable; retrying on next focus', err),
    );
  };

  // Once it has arrived, the switch's links carry it on, its results load, and the address drops `q`
  // (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The app switch"), so a reload or a link copied
  // later opens the page itself.
  useEffect(() => {
    if (!arrived) return;
    setSearchQuery(arrived);
    try {
      window.history.replaceState(window.history.state, '', locationWithQuery(location.href, ''));
    } catch {
      // A sandboxed frame may refuse; the box holds the query either way.
    }
    loadSearch(client.loadSearch).then(
      (fn) => setSearch(() => fn),
      (err: unknown) => console.warn('[help-search] search unavailable', err),
    );
  }, [arrived, client.loadSearch]);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_QUERY;
  const results = useMemo(
    () => (hasQuery && search ? search(query) : []),
    [hasQuery, query, search],
  );
  // The every-app index, in an app's help: loaded once the scope's results (or its "No articles found") show.
  const [searchAll, setSearchAll] = useState<Search | null>(null);
  const others = useMemo(
    () => (hasQuery && searchAll ? searchAll(query) : []),
    [hasQuery, query, searchAll],
  );
  const groups = useMemo(() => groupResults(results, scope, others), [results, scope, others]);
  const shown = groups.here.length + groups.elsewhere.length;
  // Until the search has loaded there is no answer yet, so neither results nor "No articles found".
  const isOpen = hasQuery && !dismissed && search !== null;

  const loadAll = client.loadSearchAll;
  const wantsOthers = isOpen && scope !== undefined && scope !== 'all' && !!loadAll && !searchAll;
  useEffect(() => {
    if (!wantsOthers || !loadAll) return;
    let live = true;
    loadSearch(loadAll).then(
      (fn) => live && setSearchAll(() => fn),
      (err: unknown) =>
        console.warn('[help-search] other apps unavailable; retrying on next search', err),
    );
    return () => {
      live = false;
    };
  }, [wantsOthers, loadAll]);

  // Report the SETTLED query's outcome, not every keystroke (docs/specs/017-telemetry/telemetry.md). The
  // timer restarts on each change, so only the query the reader stopped on is
  // counted, and the emitter dedupes repeats of it.
  useEffect(() => {
    if (!hasQuery || !search) return;
    const timer = setTimeout(
      () => reportHelpSearch(client.track, trimmed, shown),
      SEARCH_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [hasQuery, search, trimmed, shown, client.track]);

  // A press outside dismisses the open dropdown. Only listening while it's
  // open is equivalent: typing or focusing clears `dismissed` anyway.
  useClickOutside(wrapperRef, () => setDismissed(true), isOpen);

  // `/` searches from anywhere on the page (liveworkspace/docs/specs/016-help/help-centre.md "Search"), unless the reader is
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

  // Links that leave this address (Search All Apps, a "From Other Apps" result) stay in the page's deployment.
  const searchAllHref =
    scope && scope !== 'all' ? withQuery(siteHref(scopeHref('all', '/')), trimmed) : null;
  const row = (article: SearchEntry, here: boolean) => (
    <Link
      key={`${article.categorySlug}/${article.slug}`}
      href={siteHref(resultHref(article, scope, here))}
      onClick={() => {
        setQuery('');
        setDismissed(false);
      }}
      className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-brand-50/60 dark:border-slate-800 dark:hover:bg-slate-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
          {article.category}
        </span>
        <span className="mt-0.5 block text-sm font-medium text-slate-900 dark:text-slate-100">
          {article.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
          {article.description}
        </span>
      </span>
      {scope && <AppMarkRow apps={article.apps} scope={scope} size={14} className="mt-1" />}
    </Link>
  );
  const groupHeading = (text: string) => (
    <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      {text}
    </p>
  );
  const grouped = scope !== undefined && scope !== 'all';

  return (
    <div ref={wrapperRef} className="relative flex w-full items-center gap-2 text-left">
      {scope && (
        <div className={large ? 'hidden sm:block' : 'hidden lg:block'}>
          <AppSwitch size={large ? 'large' : 'header'} />
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        <SearchIcon
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={large ? 22 : 18}
        />
        <input
          ref={inputRef}
          data-help-search={large ? 'large' : 'header'}
          type="text"
          placeholder={large ? 'Search help articles...' : 'Search help'}
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
      {isOpen && shown > 0 && (
        <div
          role="region"
          aria-label="Search results"
          className="scrollbar-slim absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          {grouped && groups.here.length > 0 && groupHeading(`In ${scope}`)}
          {groups.here.map((article) => row(article, true))}
          {groups.elsewhere.length > 0 && groupHeading('From other apps')}
          {groups.elsewhere.map((article) => row(article, false))}
          {searchAllHref && (
            <a
              href={searchAllHref}
              onClick={() => client.track('Help', 'Changed', 'Scope.all')}
              className="block px-4 py-3 text-center text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50/60 dark:text-brand-300 dark:hover:bg-slate-800"
            >
              Search All Apps instead
            </a>
          )}
        </div>
      )}
      {/* What the dropdown holds, said to a screen reader: the results appear below the field with nothing else to
          announce them (liveworkspace/docs/specs/016-help/help-centre.md "Search"). */}
      <p aria-live="polite" className="sr-only">
        {isOpen
          ? shown === 0
            ? `No articles found for ${trimmed}`
            : `${shown} ${shown === 1 ? 'article' : 'articles'} found`
          : ''}
      </p>
      {isOpen && query.trim().length > 1 && shown === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No articles found for &ldquo;{query}&rdquo;
          </p>
          {searchAllHref && (
            <p className="mt-2 text-center text-sm">
              <a
                href={searchAllHref}
                onClick={() => client.track('Help', 'Changed', 'Scope.all')}
                className="font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Search All Apps instead
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
