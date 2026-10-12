'use client';

// The Looks carousel on the Tab Look & Feel home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the looks
// in pages of six, side by side in a horizontally snapping strip, so a swipe, the arrows or the page dots move between
// them. It opens on the page that holds the tab's current look. Each card is a live preview drawn by the exporter.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { lucideGlyph } from '@livediagram/ui';
import { lucideChevronLeft, lucideChevronRight } from '@livediagram/icons/lucide';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import { LOOKS_PER_PAGE, TAB_LOOKS, type TabLook, type TabLookId } from '@/lib/tab-looks';

const PrevIcon = lucideGlyph(lucideChevronLeft, 16);
const NextIcon = lucideGlyph(lucideChevronRight, 16);

const PAGES: readonly (readonly TabLook[])[] = Array.from(
  { length: Math.ceil(TAB_LOOKS.length / LOOKS_PER_PAGE) },
  (_, i) => TAB_LOOKS.slice(i * LOOKS_PER_PAGE, (i + 1) * LOOKS_PER_PAGE),
);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function LooksCarousel({
  activeLook,
  onPickLook,
  headingClass,
}: {
  activeLook: TabLookId | undefined;
  onPickLook: (id: TabLookId) => void;
  headingClass: string;
}) {
  // Each card's preview is fixed for its look, so it is drawn once per open.
  const previews = useMemo(
    () =>
      new Map(
        TAB_LOOKS.map((look) => [
          look.id,
          { markup: lookPreviewSvg(look), paper: lookPreviewTab(look).backgroundColor },
        ]),
      ),
    [],
  );
  const strip = useRef<HTMLDivElement>(null);
  // Open on the page holding the current look (the first when the tab has its own mix).
  const [page, setPage] = useState(() => {
    const at = TAB_LOOKS.findIndex((l) => l.id === activeLook);
    return at < 0 ? 0 : Math.floor(at / LOOKS_PER_PAGE);
  });
  useLayoutEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = page * el.clientWidth;
    // The opening page only: later moves scroll the strip themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const goTo = (next: number) => {
    const el = strip.current;
    const clamped = Math.max(0, Math.min(PAGES.length - 1, next));
    setPage(clamped);
    el?.scrollTo?.({
      left: clamped * el.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };
  const navButton =
    'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

  return (
    <section aria-labelledby="looks-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="looks-heading" className={headingClass}>
          Looks
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous looks"
            disabled={page === 0}
            onClick={() => goTo(page - 1)}
            className={navButton}
          >
            <PrevIcon />
          </button>
          <div className="flex items-center gap-1.5 px-1">
            {PAGES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Looks page ${i + 1} of ${PAGES.length}`}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="flex h-6 w-4 items-center justify-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === page ? 'w-4 bg-brand-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Next looks"
            disabled={page === PAGES.length - 1}
            onClick={() => goTo(page + 1)}
            className={navButton}
          >
            <NextIcon />
          </button>
        </div>
      </div>
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PAGES.map((looks, i) => (
          <div
            key={i}
            role="group"
            aria-label={`Looks page ${i + 1} of ${PAGES.length}`}
            className="grid w-full shrink-0 snap-start grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            {looks.map((look) => (
              <LookCard
                key={look.id}
                look={look}
                active={activeLook === look.id}
                markup={previews.get(look.id)!.markup}
                paper={previews.get(look.id)!.paper}
                onPick={() => onPickLook(look.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LookCard({
  look,
  active,
  markup,
  paper,
  onPick,
}: {
  look: TabLook;
  active: boolean;
  markup: string;
  paper: string | undefined;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`flex flex-col overflow-hidden rounded-lg text-left transition ${
        active
          ? 'border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
          : 'border border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        className="block h-20 w-full overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ backgroundColor: paper }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <span className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {look.label}
        </span>
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {look.description}
        </span>
      </span>
    </button>
  );
}
