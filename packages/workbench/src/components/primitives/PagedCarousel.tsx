'use client';

// A paged carousel of tiles (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Colours panel"): items in
// pages of a fixed size, side by side in a horizontally snapping strip, so a swipe, the arrows or the page dots move
// between them. It opens on the page holding `initialIndex`. One page shows no navigation. Used by the Looks and the
// theme list, so the two page the same way.
//
// Every page keeps its slot in the strip, but only the page on show and its neighbours mount their tiles (the Looks'
// tiles are whole SVG scenes, so the far pages cost a dialog's open for nothing). A move by the dots keeps the pages
// it slides past mounted until it lands, and a page holding focus stays mounted, so focus is never dropped.

import { useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideChevronLeft, lucideChevronRight } from '@liveworkspace/icons/lucide';

const PrevIcon = lucideGlyph(lucideChevronLeft, 16);
const NextIcon = lucideGlyph(lucideChevronRight, 16);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** A dots move under way: the page it left and the page it is sliding to. */
export type Slide = { from: number; to: number };

/** Whether page `i` mounts its tiles: within one of the page on show, inside a slide's span, or holding focus. */
export function pageMounted(
  i: number,
  page: number,
  slide: Slide | null,
  focused: number | null,
): boolean {
  if (Math.abs(i - page) <= 1 || i === focused) return true;
  if (slide === null) return false;
  return i >= Math.min(slide.from, slide.to) - 1 && i <= Math.max(slide.from, slide.to) + 1;
}

const NAV_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function PagedCarousel<T>({
  items,
  perPage,
  label,
  heading,
  gridClass,
  initialIndex,
  renderItem,
  navTourId,
  controls,
}: {
  items: readonly T[];
  perPage: number;
  // What the pages hold, for the controls' names ("Looks" → "Next looks", "Looks page 1 of 2").
  label: string;
  // The section's heading, beside the controls.
  heading: ReactNode;
  // Each page's grid (columns and gap).
  gridClass: string;
  // Opens on the page holding this item; the first page when it is negative or absent.
  initialIndex?: number;
  renderItem: (item: T) => ReactNode;
  // A Show Me target on the page controls.
  navTourId?: string;
  // Controls of the section's own, left of the page controls (the Looks' Finish filter).
  controls?: ReactNode;
}) {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const strip = useRef<HTMLDivElement>(null);
  const [chosen, setPage] = useState(() =>
    initialIndex !== undefined && initialIndex >= 0 ? Math.floor(initialIndex / perPage) : 0,
  );
  // Clamped, so a list that shrinks under the carousel (a filter without a remount) never leaves it on a page that
  // is gone, with nothing mounted.
  const page = Math.min(chosen, Math.max(0, pages.length - 1));
  useLayoutEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = page * el.clientWidth;
    // The opening page only: later moves scroll the strip themselves.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
  // A dots move's span, until the strip arrives; the page holding focus.
  const [slide, setSlide] = useState<Slide | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const goTo = (next: number) => {
    const el = strip.current;
    const clamped = Math.max(0, Math.min(pages.length - 1, next));
    // The slide passes every page between here and there: keep them mounted until it lands.
    setSlide(Math.abs(clamped - page) > 1 ? { from: page, to: clamped } : null);
    setPage(clamped);
    el?.scrollTo?.({
      left: clamped * el.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };
  const lower = label.toLowerCase();

  return (
    <div className="flex flex-col gap-2">
      {/* px-1 lines the heading up with the tiles, which sit inside their page's p-1. */}
      <div className="flex min-h-8 items-center justify-between gap-2 px-1">
        {heading}
        <div className="flex items-center gap-2">
          {controls}
          {pages.length > 1 ? (
            <div className="flex items-center gap-1" data-tour-id={navTourId}>
              <button
                type="button"
                aria-label={`Previous ${lower}`}
                disabled={page === 0}
                onClick={() => goTo(page - 1)}
                className={NAV_BUTTON}
              >
                <PrevIcon />
              </button>
              <div className="flex items-center gap-1.5 px-1">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${label} page ${i + 1} of ${pages.length}`}
                    aria-current={i === page ? 'true' : undefined}
                    onClick={() => goTo(i)}
                    className="flex h-6 w-4 items-center justify-center"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all motion-reduce:transition-none ${
                        i === page ? 'w-4 bg-brand-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label={`Next ${lower}`}
                disabled={page === pages.length - 1}
                onClick={() => goTo(page + 1)}
                className={NAV_BUTTON}
              >
                <NextIcon />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {/* The strip scrolls sideways, so it clips anything drawn past a tile; each page's `p-1` keeps a selected
          tile's ring and border inside it. The strip stays inside its column: pulled out (a negative margin), a
          parent that clips (the palette panel) cut the left tile's border. */}
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth <= 0) return;
          const at = Math.round(el.scrollLeft / el.clientWidth);
          setPage(at);
          if (slide && at === slide.to) setSlide(null);
        }}
        className="relative flex snap-x snap-mandatory items-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((pageItems, i) =>
          pageMounted(i, page, slide, focused) ? (
            <div
              key={i}
              role="group"
              aria-label={`${label} page ${i + 1} of ${pages.length}`}
              onFocus={() => setFocused(i)}
              onBlur={(e: FocusEvent<HTMLDivElement>) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
              }}
              className={`w-full shrink-0 snap-start p-1 ${gridClass}`}
            >
              {pageItems.map(renderItem)}
            </div>
          ) : (
            // A slot of the page's width, so the strip still scrolls and snaps to it; its height comes from the
            // mounted pages beside it (the strip is as tall as its tallest page).
            <div key={i} aria-hidden className="w-full shrink-0 snap-start" />
          ),
        )}
      </div>
    </div>
  );
}
