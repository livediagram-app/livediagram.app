'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import type { TelemetryWindowKey } from '@livediagram/api-schema';
import { WINDOW_META } from './windows';

// Three dots — the "more / switch view" affordance in the sticky bar.
function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

type ViewOption = { key: string; label: string; icon: ReactNode };

// A condensed version of the WindowPanel's Today / Last 7 / Last month
// selector. It fades in, fixed just below the sticky site header, once the
// full panel has scrolled out of view, so the active timeframe stays
// changeable while the reader is deep in a long list. An IntersectionObserver
// on the panel drives the show/hide; no scroll listener.
//
// To its right, an ellipsis menu switches the active view (Highlights,
// Acquisition, Raw, …) — the tab row also scrolls away, so this keeps the
// "which lens" control reachable too. The timeframe buttons stay inline
// (out of the menu); only the view picker collapses into the ellipsis.
export function StickyWindowBar({
  watchRef,
  active,
  onSelect,
  views,
  view,
  onSelectView,
}: {
  watchRef: RefObject<HTMLElement | null>;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
  views: ViewOption[];
  view: string;
  onSelectView: (key: string) => void;
}) {
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = watchRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Visible only once the panel has scrolled ABOVE the viewport
        // (its box sits past the top), not when it's still below the fold.
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      // Negative top margin ≈ the sticky SiteHeader height, so the bar
      // appears as the panel slips under the header rather than off-screen.
      { rootMargin: '-80px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [watchRef]);

  // Close the view menu whenever the bar hides (e.g. scrolling back up).
  useEffect(() => {
    if (!stuck) setMenuOpen(false);
  }, [stuck]);

  const activeView = views.find((v) => v.key === view);

  return (
    <div
      aria-hidden={!stuck}
      className={
        'fixed inset-x-0 top-24 z-30 flex justify-center px-4 transition-all duration-200 ' +
        (stuck ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0')
      }
    >
      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10">
        {WINDOW_META.map((w) => {
          const isActive = active === w.key;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => onSelect(w.key)}
              aria-pressed={isActive}
              className={
                'cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
                (isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {w.label}
            </button>
          );
        })}

        {/* Divider, then the view (category) picker. */}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Switch view"
            title={activeView ? `View: ${activeView.label}` : 'Switch view'}
            className={
              'flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ' +
              (menuOpen
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            {activeView ? (
              <span aria-hidden className="[&_svg]:h-3.5 [&_svg]:w-3.5">
                {activeView.icon}
              </span>
            ) : null}
            <EllipsisIcon />
          </button>

          {menuOpen ? (
            <>
              {/* Click-away backdrop. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
              >
                {views.map((v) => {
                  const isCurrent = v.key === view;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelectView(v.key);
                        setMenuOpen(false);
                      }}
                      className={
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ' +
                        (isCurrent
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800')
                      }
                    >
                      <span aria-hidden className="[&_svg]:h-4 [&_svg]:w-4">
                        {v.icon}
                      </span>
                      <span className="flex-1 truncate">{v.label}</span>
                      {isCurrent ? (
                        <span aria-hidden className="text-xs">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
