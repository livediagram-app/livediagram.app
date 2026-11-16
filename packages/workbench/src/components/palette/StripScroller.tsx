'use client';

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, Tooltip } from '@liveworkspace/ui';
import { STRIP_RAIL_SCROLL } from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

// A strip rail that gives way and scrolls sideways (docs/specs/007-editor/toolbar-layout.md "Names fit or go"), with a
// way to see that it does: each edge with more beyond it carries a fade in the card's own colour and a small scroll
// button. The fade covers the item the edge cuts, so no label shows cut mid-word, and the button reads as "more this
// way" to a mouse, which has no swipe. A press scrolls to the next whole item past the edge (smoothly, or at once under
// reduced motion). The buttons stay out of the Tab order: the arrow keys walk the bar, and the browser scrolls a
// focused item into view. An edge with nothing beyond it shows neither.

/** The room an edge's fade and button take, in px: what a press keeps clear of the next item. */
export const STRIP_SCROLL_EDGE_PX = 44;

export type StripOverflow = { start: boolean; end: boolean };

const NONE: StripOverflow = { start: false, end: false };

// Whether the scroller has more beyond each edge. A pixel of slack absorbs fractional widths.
export function stripOverflowOf(el: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}): StripOverflow {
  const room = el.scrollWidth - el.clientWidth;
  if (room <= 1) return NONE;
  return { start: el.scrollLeft > 1, end: el.scrollLeft < room - 1 };
}

// Where a press on an edge's button scrolls to: the first item the far edge cuts, laid whole past the fade on its
// side. Items are measured against the scroller (offsetLeft is from its padding edge, the frame scrollLeft uses).
export function stripScrollTarget(
  el: { scrollLeft: number; clientWidth: number },
  items: readonly { offsetLeft: number; offsetWidth: number }[],
  side: 'start' | 'end',
): number {
  const { scrollLeft, clientWidth } = el;
  if (side === 'end') {
    const visibleEnd = scrollLeft + clientWidth - STRIP_SCROLL_EDGE_PX;
    const next = items.find((item) => item.offsetLeft + item.offsetWidth > visibleEnd);
    return next ? next.offsetLeft - STRIP_SCROLL_EDGE_PX : scrollLeft + clientWidth;
  }
  const visibleStart = scrollLeft + STRIP_SCROLL_EDGE_PX;
  const previous = [...items].reverse().find((item) => item.offsetLeft < visibleStart);
  return previous
    ? previous.offsetLeft + previous.offsetWidth - clientWidth + STRIP_SCROLL_EDGE_PX
    : scrollLeft - clientWidth;
}

// Follows the scroller's overflow as it scrolls, resizes or its items change. One state write per change of either
// edge, never per scroll frame.
function useStripOverflow(ref: RefObject<HTMLElement | null>, itemsKey: string): StripOverflow {
  const [overflow, setOverflow] = useState<StripOverflow>(NONE);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () =>
      setOverflow((was) => {
        const now = stripOverflowOf(el);
        return was.start === now.start && was.end === now.end ? was : now;
      });
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    ro?.observe(el);
    for (const child of el.children) ro?.observe(child);
    return () => {
      el.removeEventListener('scroll', sync);
      ro?.disconnect();
    };
  }, [ref, itemsKey]);
  return overflow;
}

export function StripScroller({
  label,
  role = 'toolbar',
  itemsKey,
  children,
}: {
  // The strip's accessible name ("Palette categories").
  label: string;
  role?: 'toolbar' | 'group';
  // Changes when the items do (their ids), so a new set is measured at once.
  itemsKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const overflow = useStripOverflow(ref, itemsKey);
  const scroll = (side: 'start' | 'end') => {
    const el = ref.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    el.scrollTo({
      left: stripScrollTarget(el, items, side),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };
  return (
    // The wrapper is the rail the strip's card lets shrink (`data-strip-rail`); the scroller inside it swipes.
    <div data-strip-rail="" className="relative flex min-w-0 items-center">
      <div
        ref={ref}
        role={role}
        aria-label={label}
        className={`flex items-center ${STRIP_RAIL_SCROLL}`}
      >
        {children}
      </div>
      {overflow.start ? <StripEdge side="start" onPress={() => scroll('start')} /> : null}
      {overflow.end ? <StripEdge side="end" onPress={() => scroll('end')} /> : null}
    </div>
  );
}

// A strip's toolbar: a StripScroller where it swipes (a phone's row), a plain row where it fits.
export function StripRail({
  scrollable,
  label,
  itemsKey,
  children,
}: {
  scrollable: boolean;
  label: string;
  itemsKey: string;
  children: ReactNode;
}) {
  if (scrollable)
    return (
      <StripScroller label={label} itemsKey={itemsKey}>
        {children}
      </StripScroller>
    );
  return (
    <div role="toolbar" aria-label={label} className="flex items-center">
      {children}
    </div>
  );
}

// One edge's fade and button. The fade lets presses through to the strip; only the button takes them.
function StripEdge({ side, onPress }: { side: 'start' | 'end'; onPress: () => void }) {
  const end = side === 'end';
  const name = end ? 'Scroll Right' : 'Scroll Left';
  return (
    <div
      data-strip-edge={side}
      className={`pointer-events-none absolute inset-y-0 flex w-11 items-center ${
        end
          ? 'right-0 justify-end bg-gradient-to-l'
          : 'left-0 justify-start bg-gradient-to-r'
      } from-white from-50% to-transparent dark:from-slate-900`}
    >
      <Tooltip label={name}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={name}
          // Pressed with the pointer only: keep the focus where it was (on the canvas, or a bar button).
          onPointerDown={(e) => e.preventDefault()}
          onClick={onPress}
          className="pointer-events-auto flex h-7 w-7 touch-target items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          {end ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
        </button>
      </Tooltip>
    </div>
  );
}
