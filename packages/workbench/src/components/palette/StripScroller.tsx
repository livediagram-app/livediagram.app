'use client';

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, Tooltip } from '@liveworkspace/ui';
import { STRIP_RAIL_SCROLL } from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

// A strip rail that gives way and scrolls sideways (docs/specs/007-editor/toolbar-layout.md "Names fit or go"), with a
// way to see that it does: each edge with more beyond it carries a fade in the card's own colour and a small scroll
// button. The fade is sized to the item the edge cuts and covers it whole (solid over all of it, soft only over the
// gap short of it), so no label ever reads cut mid-word, and the button reads as "more this way" to a
// mouse, which has no swipe. A press scrolls past everything shown, so the item the fade hid lands first, whole, past
// the other edge (smoothly, or at once under reduced motion): as far as a press can go without skipping an item. The buttons stay out of the Tab order: the arrow keys walk the bar, and the browser scrolls a
// focused item into view. An edge with nothing beyond it shows neither.

/** The room an edge's fade and button take, in px: what a press keeps clear of the next item. */
export const STRIP_SCROLL_EDGE_PX = 44;

/** The soft part of a fade, just short of the item it hides (over the gap before it), in px. */
export const STRIP_FADE_SOFT_PX = 6;

export type StripOverflow = { start: boolean; end: boolean };

const NONE: StripOverflow = { start: false, end: false };

/** How wide each edge's fade is, in px: 0 where the edge has nothing beyond it. */
export type StripCovers = { start: number; end: number };

const NO_COVERS: StripCovers = { start: 0, end: 0 };

type Item = { offsetLeft: number; offsetWidth: number };

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

// How wide each edge's fade must be to hide the item it cuts whole: from the edge to that item's far side, never less
// than the button's room nor more than the view less the other edge's. An item is cut when any of it lies under the
// button's room. Items are measured against the scroller (offsetLeft is from its padding edge,
// the frame scrollLeft uses).
export function stripEdgeCovers(
  el: { scrollLeft: number; scrollWidth: number; clientWidth: number },
  items: readonly Item[],
): StripCovers {
  const overflow = stripOverflowOf(el);
  if (!overflow.start && !overflow.end) return NO_COVERS;
  const { scrollLeft, clientWidth } = el;
  const viewEnd = scrollLeft + clientWidth;
  const most = Math.max(STRIP_SCROLL_EDGE_PX, clientWidth - STRIP_SCROLL_EDGE_PX);
  const cover = (px: number) => Math.ceil(Math.min(most, Math.max(STRIP_SCROLL_EDGE_PX, px)));
  let end = 0;
  if (overflow.end) {
    const cut = cutAt(el, items, 'end');
    end = cover(cut ? viewEnd - cut.offsetLeft : 0);
  }
  let start = 0;
  if (overflow.start) {
    const cut = cutAt(el, items, 'start');
    start = cover(cut ? cut.offsetLeft + cut.offsetWidth - scrollLeft : 0);
  }
  return { start, end };
}

// The item an edge cuts: the nearest to the middle that lies, any of it, under that edge's button room.
function cutAt(
  el: { scrollLeft: number; clientWidth: number },
  items: readonly Item[],
  side: 'start' | 'end',
): Item | undefined {
  const { scrollLeft, clientWidth } = el;
  if (side === 'end') {
    const viewEnd = scrollLeft + clientWidth;
    return items.find(
      (item) =>
        item.offsetLeft < viewEnd &&
        item.offsetLeft + item.offsetWidth > viewEnd - STRIP_SCROLL_EDGE_PX,
    );
  }
  return [...items]
    .reverse()
    .find(
      (item) =>
        item.offsetLeft + item.offsetWidth > scrollLeft &&
        item.offsetLeft < scrollLeft + STRIP_SCROLL_EDGE_PX,
    );
}

// Where a press on an edge's button scrolls to: past everything shown, so the item that edge's fade hides lands first,
// whole, past the other edge's button room. That is as far as a press can go without skipping an item. Where no item
// is hidden there (or one wider than the view), it moves the view less both buttons' room.
export function stripScrollTarget(
  el: { scrollLeft: number; clientWidth: number },
  items: readonly Item[],
  side: 'start' | 'end',
): number {
  const { scrollLeft, clientWidth } = el;
  const page = Math.max(STRIP_SCROLL_EDGE_PX, clientWidth - 2 * STRIP_SCROLL_EDGE_PX);
  const cut = cutAt(el, items, side);
  if (side === 'end') {
    const to = cut ? cut.offsetLeft - STRIP_SCROLL_EDGE_PX : 0;
    return to > scrollLeft + 1 ? to : scrollLeft + page;
  }
  const to = cut ? cut.offsetLeft + cut.offsetWidth + STRIP_SCROLL_EDGE_PX - clientWidth : 0;
  return cut && to < scrollLeft - 1 ? to : scrollLeft - page;
}

// Follows each edge's fade as the scroller scrolls, resizes or its items change. One state write per change of a
// fade's width (a whole pixel), never per scroll frame where nothing changes.
function useStripCovers(ref: RefObject<HTMLElement | null>, itemsKey: string): StripCovers {
  const [covers, setCovers] = useState<StripCovers>(NO_COVERS);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () =>
      setCovers((was) => {
        const now = stripEdgeCovers(el, [...el.children] as HTMLElement[]);
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
  return covers;
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
  const covers = useStripCovers(ref, itemsKey);
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
      {covers.start > 0 ? (
        <StripEdge side="start" width={covers.start} onPress={() => scroll('start')} />
      ) : null}
      {covers.end > 0 ? (
        <StripEdge side="end" width={covers.end} onPress={() => scroll('end')} />
      ) : null}
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

// One edge's fade and button: solid in the card's colour for `width` px (over the item it hides), then soft for a few
// pixels short of it, over the gap. The fade lets presses through to the strip; only the button takes them.
function StripEdge({
  side,
  width,
  onPress,
}: {
  side: 'start' | 'end';
  width: number;
  onPress: () => void;
}) {
  const end = side === 'end';
  const name = end ? 'Scroll Right' : 'Scroll Left';
  return (
    <div
      data-strip-edge={side}
      style={{
        width: width + STRIP_FADE_SOFT_PX,
        backgroundImage: `linear-gradient(to ${end ? 'left' : 'right'}, var(--strip-fade) calc(100% - ${STRIP_FADE_SOFT_PX}px), transparent)`,
      }}
      className={`pointer-events-none absolute inset-y-0 flex items-center [--strip-fade:var(--color-white)] dark:[--strip-fade:var(--color-slate-900)] ${
        end ? 'right-0 justify-end' : 'left-0 justify-start'
      }`}
    >
      <Tooltip label={name}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={name}
          // Pressed with the pointer only: keep the focus where it was (on the canvas, or a bar button).
          onPointerDown={(e) => e.preventDefault()}
          onClick={onPress}
          className="pointer-events-auto relative flex h-7 w-7 touch-target items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          {end ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
        </button>
      </Tooltip>
    </div>
  );
}
