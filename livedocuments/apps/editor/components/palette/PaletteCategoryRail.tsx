'use client';

import { useRef, type ReactNode } from 'react';
import { CountBadge, NoMatches } from '@livedocuments/ui';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import type { BrowserCategory } from './PaletteCategoryBrowser';

// The category browse as a two-pane picker (docs/specs/007-editor/toolbar-layout.md "The category bar"), for the
// category bar's flyouts (Icons, Stickers, Technology, Session): the groups down a rail on the left, each its glyph,
// name and count, and the open group's entries on the right under its name. One search across the top cuts across
// every group, as the drill-in browse's does. Nothing to drill into or back out of: every group is one press away,
// and the one open is always in view. The panes keep one height, so switching group never moves the flyout.

export function PaletteCategoryRail<T>({
  categories,
  openId,
  onOpen,
  renderItems,
  query,
  onQueryChange,
  matches,
  search,
  things,
  loading,
  loadingMessage,
}: {
  categories: BrowserCategory<T>[];
  // The open group, or null for the first.
  openId: string | null;
  onOpen: (id: string) => void;
  renderItems: (items: T[]) => ReactNode;
  query: string;
  onQueryChange: (next: string) => void;
  // The search's hits, or null with no query.
  matches: T[] | null;
  search: {
    placeholder: string;
    ariaLabel: string;
    clearAriaLabel: string;
    clearDescription: string;
  };
  things: string;
  loading: boolean;
  loadingMessage: string;
}) {
  const open = categories.find((c) => c.id === openId) ?? categories[0] ?? null;
  const paneRef = useRef<HTMLDivElement>(null);
  const choose = (id: string) => {
    if (query) onQueryChange('');
    onOpen(id);
    if (paneRef.current) paneRef.current.scrollTop = 0;
  };
  return (
    <div className="flex flex-col">
      <div className="flex border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder={search.placeholder}
          ariaLabel={search.ariaLabel}
          clearAriaLabel={search.clearAriaLabel}
          clearDescription={search.clearDescription}
        />
      </div>
      <div className="flex h-[min(360px,calc(100dvh-20rem))] min-h-[220px]">
        <nav
          aria-label={`${things} groups`}
          className="flex w-[188px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-1.5 [scrollbar-width:thin] dark:border-slate-800 dark:bg-slate-950/30"
        >
          {categories.map((c) => {
            const current = !matches && open?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-current={current || undefined}
                onClick={() => choose(c.id)}
                className={`group relative flex h-9 w-full shrink-0 items-center gap-2 rounded-lg pl-2 pr-1.5 text-left transition ${
                  current
                    ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-brand-200 dark:ring-slate-700'
                    : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`}
              >
                {/* The open group's accent, on the rail's edge. */}
                <span
                  aria-hidden
                  className={`absolute -left-1.5 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-500 transition-opacity duration-micro ${current ? 'opacity-100' : 'opacity-0'}`}
                />
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:max-h-[18px] [&>svg]:max-w-[18px]"
                >
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{c.label}</span>
                <CountBadge count={c.items.length} className="shrink-0" />
              </button>
            );
          })}
        </nav>
        <div ref={paneRef} className="min-w-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          <div className="sticky top-0 z-[1] flex items-center gap-2 bg-white/95 px-3 pb-1.5 pt-2.5 backdrop-blur dark:bg-slate-900/95">
            <span className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
              {matches ? `Results for “${query.trim()}”` : (open?.label ?? '')}
            </span>
            <CountBadge count={matches ? matches.length : (open?.items.length ?? 0)} />
          </div>
          {/* Keyed on what it shows, so a switch fades the new entries in. */}
          <div key={matches ? `?${query}` : (open?.id ?? '')} className="animate-fade-in px-2 pb-3">
            {loading ? (
              <p className="px-1 py-6 text-center text-[11.5px] text-slate-500 dark:text-slate-400">
                {loadingMessage}
              </p>
            ) : matches ? (
              matches.length > 0 ? (
                renderItems(matches)
              ) : (
                <NoMatches things={things} query={query} onClear={() => onQueryChange('')} />
              )
            ) : open ? (
              renderItems(open.items)
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
