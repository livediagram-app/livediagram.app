'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { TelemetryWindowKey } from '@livediagram/api-schema';
import { WINDOW_META } from './windows';

// A condensed version of the WindowPanel's Today / Last 7 / Last month
// selector. It fades in, fixed just below the sticky site header, once the
// full panel has scrolled out of view, so the active timeframe stays
// changeable while the reader is deep in a long list. An IntersectionObserver
// on the panel drives the show/hide; no scroll listener.
export function StickyWindowBar({
  watchRef,
  active,
  onSelect,
}: {
  watchRef: RefObject<HTMLElement | null>;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
}) {
  const [stuck, setStuck] = useState(false);

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

  return (
    <div
      aria-hidden={!stuck}
      className={
        'fixed inset-x-0 top-24 z-30 flex justify-center px-4 transition-all duration-200 ' +
        (stuck ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0')
      }
    >
      <div className="inline-flex gap-1.5 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10">
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
      </div>
    </div>
  );
}
