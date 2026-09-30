'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Glyph } from './icons/Glyph';

// A heading row over a horizontal, scroll-snapping track of cards, with prev /
// next arrows that page through it. Shared by the landing page's template
// gallery (docs/specs/019-marketing/marketing-site.md) and the editor's template picker
// (docs/specs/008-canvas/canvas-and-palette.md "Templates section"), so the two browse a
// category the same way.
//
// The track is a real horizontal scroller, so a touch swipe works too and the
// arrows just scroll it by one page; scroll-snap lands a swipe on a card edge.
// How many cards make a page is pure CSS (the caller's `itemClassName` sizes
// each `li`), so the arrows never have to know it. Arrows disable at either
// end and hide (keeping their space) when every card already fits.
export function SnapCarousel({
  heading,
  label,
  itemsKey,
  className,
  trackClassName = 'mt-3',
  itemClassName,
  children,
}: {
  // The heading row's left side: the category name, and any badge beside it.
  heading: ReactNode;
  // Plain-text name for the arrows' accessible labels ("Next Agile templates").
  label: string;
  // Changes when the row's cards change (a filter, another category), so the
  // track rewinds rather than staying scrolled past cards no longer there.
  itemsKey: string;
  className?: string;
  trackClassName?: string;
  // Sizes each card: a snap point whose basis makes a page whole cards.
  itemClassName: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemsKey, measure]);

  // A page is one visible width PLUS the gap before the next card: whole
  // cards fill the width with a gap between each, so the next page starts a
  // gap past the edge. Scrolling by clientWidth alone fell a gap short each
  // press, and iOS Safari doesn't re-snap a programmatic smooth scroll, so
  // the card sat shifted right with its right border clipped. Landing on a
  // whole multiple of the stride also realigns a swipe that stopped between
  // pages.
  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const stride = el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
    const target = (Math.round(el.scrollLeft / stride) + direction) * stride;
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  const paged = canPrev || canNext;
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">{heading}</div>
        {/* Always rendered, only hidden when every card fits: the track is
            measured after mount, and arrows that appeared then made the heading
            row taller and nudged everything below it on load. `invisible`
            keeps their space and takes them out of the tab order and the
            accessibility tree. */}
        <div
          className={`flex shrink-0 items-center gap-1.5 ${paged ? '' : 'invisible'}`}
          aria-hidden={paged ? undefined : true}
        >
          <CarouselArrow
            direction="prev"
            label={label}
            disabled={!canPrev}
            onClick={() => page(-1)}
          />
          <CarouselArrow
            direction="next"
            label={label}
            disabled={!canNext}
            onClick={() => page(1)}
          />
        </div>
      </div>
      {/* The scrollbar is hidden: the arrows and swipe are the controls. */}
      <ul
        ref={track}
        onScroll={measure}
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:grow [&>li]:snap-start ${itemClassName} ${trackClassName}`}
      >
        {children}
      </ul>
    </div>
  );
}

function CarouselArrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const prev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${prev ? 'Previous' : 'Next'} ${label} templates`}
      className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 transition enabled:hover:border-brand-300 enabled:hover:text-brand-700 disabled:cursor-default disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:text-white"
    >
      <Glyph size={18} units={24}>
        {prev ? <path d="M15 6 L9 12 L15 18" /> : <path d="M9 6 L15 12 L9 18" />}
      </Glyph>
    </button>
  );
}
