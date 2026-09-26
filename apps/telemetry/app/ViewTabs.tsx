'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// The dashboard's view selector (docs/specs/017-telemetry/telemetry.md). The `leads` (the Dashboard, then
// Search) stand on their own to the left: the overview and the way to find any
// one metric. Every other view is a closer look at one area, so those sit
// together in a bar titled "Detail".
// Both halves are one tablist, so keyboard and screen-reader users still get a
// single set of tabs. Always one row: the Detail bar takes the rest of the
// width and becomes a carousel when its tabs outgrow it (a second row read as
// a separate control).
//
// The Detail bar is a single-line carousel. Its tabs are wider than the column
// on a phone (and even on some laptops), and both wrapping to two rows and a
// bare scrollbar read as messy, so the row stays on ONE line inside a
// hidden-overflow scroller, with left/right chevrons that appear only when
// there's more to reach. Picking a tab also scrolls it into view, so the
// active one is never clipped at an edge.

type TabOption<K extends string> = { key: K; label: string; icon: ReactNode };

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ViewTabs<K extends string>({
  views,
  leads,
  view,
  onSelect,
}: {
  views: TabOption<K>[];
  leads: K[]; // the views that stand apart, left of the Detail bar, in order
  view: K;
  onSelect: (key: K) => void;
}) {
  const leadViews = leads.flatMap((key) => views.filter((v) => v.key === key));
  const detail = views.filter((v) => !leads.includes(v.key));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow(max > 1);
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < max - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  // Keep the active tab visible when it changes (e.g. switched from the
  // sticky bar's ellipsis menu while the carousel sits at the other end).
  useEffect(() => {
    const el = scrollerRef.current;
    el?.querySelector('[aria-selected="true"]')?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
    });
  }, [view]);

  const nudge = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === 'left' ? -el.clientWidth * 0.7 : el.clientWidth * 0.7,
      behavior: 'smooth',
    });
  };

  const arrowClass = (enabled: boolean) =>
    'flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition ' +
    (enabled
      ? 'cursor-pointer hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800'
      : 'cursor-default opacity-30');

  const tabClass = (selected: boolean) =>
    'flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
    (selected
      ? 'bg-brand-500 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800');
  const bar =
    'flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900';

  return (
    <div role="tablist" aria-label="Telemetry views" className="mt-8 flex items-center gap-3">
      {leadViews.length > 0 ? (
        <div className={`${bar} shrink-0`}>
          {leadViews.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              aria-label={v.label}
              onClick={() => onSelect(v.key)}
              className={tabClass(view === v.key)}
            >
              <span aria-hidden className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {v.icon}
              </span>
              {/* Icon-only on a phone, so the Detail carousel beside it has
                  room for its tabs; the aria-label keeps the name. */}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className={`${bar} min-w-0 flex-1`}>
        <span
          aria-hidden
          className="hidden shrink-0 pl-2 pr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:inline"
        >
          Detail
        </span>
        {overflow ? (
          <button
            type="button"
            aria-label="Scroll views left"
            disabled={!canLeft}
            onClick={() => nudge('left')}
            className={arrowClass(canLeft)}
          >
            <Chevron dir="left" />
          </button>
        ) : null}

        <div
          ref={scrollerRef}
          role="group"
          aria-label="Detail"
          onScroll={measure}
          className="flex min-w-0 gap-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {detail.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => onSelect(v.key)}
              className={tabClass(view === v.key)}
            >
              <span aria-hidden className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {v.icon}
              </span>
              {v.label}
            </button>
          ))}
        </div>

        {overflow ? (
          <button
            type="button"
            aria-label="Scroll views right"
            disabled={!canRight}
            onClick={() => nudge('right')}
            className={arrowClass(canRight)}
          >
            <Chevron dir="right" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
