'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// One category's row of the template gallery (spec/16): a scroll-snapping
// track that shows four cards across on desktop (two on a tablet, one on a
// phone; the page size is pure CSS, so the arrows never have to know it),
// with prev / next arrows in the heading row that page through the rest.
// The track is a real horizontal scroller, so a touch swipe works too and
// the arrows just scroll it by one visible width; scroll-snap lands the
// page on a card edge. Arrows disable at either end and hide when every
// card already fits.
export function TemplateCarousel({
  label,
  itemsKey,
  children,
}: {
  label: string;
  // Changes when the row's cards change (a filter), so the track rewinds
  // rather than staying scrolled past cards that are no longer there.
  itemsKey: string;
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

  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  };

  const paged = canPrev || canNext;
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h3>
        {paged ? (
          <div className="flex items-center gap-1.5">
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
        ) : null}
      </div>
      {/* Each card is a snap point sized to a quarter / half / all of the
          track less the gaps, so a page is always whole cards. The
          scrollbar is hidden: the arrows and swipe are the controls. */}
      <ul
        ref={track}
        onScroll={measure}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:snap-start [&>li]:basis-full sm:[&>li]:basis-[calc((100%-0.75rem)/2)] lg:[&>li]:basis-[calc((100%-2.25rem)/4)]"
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
      className="flex items-center justify-center rounded-full border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition enabled:hover:border-brand-400 enabled:hover:text-white disabled:cursor-default disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {prev ? <path d="M15 6 L9 12 L15 18" /> : <path d="M9 6 L15 12 L9 18" />}
      </svg>
    </button>
  );
}
