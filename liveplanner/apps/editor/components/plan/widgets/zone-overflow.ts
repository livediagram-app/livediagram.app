'use client';

// A too-full widget zone (docs/specs/026-plan/board-widgets.md "The header"): while the widgets run past the zone's
// room, the Filter widget holds the zone's start outside the sideways scroll (so it is always in reach, however the
// rest are scrolled), and a soft fade at a scrolled edge says more is there. Out of overflow the widgets sit in their
// own order, as before. The pure part (which widgets scroll, a slot or a nudge in the scrolling row put back into the
// board's list) is here beside the hook that measures.
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { nudgeWidget, type BoardWidgetId } from '@liveplanner/items';

// The widget that holds the zone's start while it overflows.
export const PINNED_WIDGET: BoardWidgetId = 'filter';

// Pixels the row must come back under its room by before the Filter returns to its place, so a width at the edge
// (a count growing by a digit) never flips it back and forth.
export const UNPIN_SLACK_PX = 12;

// The fade at a scrolled edge, in pixels.
export const EDGE_FADE_PX = 20;

// The widgets the scrolling row holds: every one but the pinned Filter, while it is pinned.
export function scrollingWidgets(
  widgets: readonly BoardWidgetId[],
  pinned: boolean,
): readonly BoardWidgetId[] {
  return pinned ? widgets.filter((k) => k !== PINNED_WIDGET) : widgets;
}

// A drop slot among the scrolling row's widgets, as an index into the board's own list (placeWidget's).
export function slotInList(
  widgets: readonly BoardWidgetId[],
  row: readonly BoardWidgetId[],
  slot: number,
): number {
  return slot < row.length ? widgets.indexOf(row[slot]!) : widgets.length;
}

// Alt+← or Alt+→ on a widget of the scrolling row: it passes its visible neighbour, the pinned Filter keeping its
// place in the board's list.
export function nudgeInRow(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
  delta: -1 | 1,
  pinned: boolean,
): BoardWidgetId[] {
  const at = widgets.indexOf(PINNED_WIDGET);
  if (!pinned || at < 0) return nudgeWidget(widgets, kind, delta);
  const next = nudgeWidget(scrollingWidgets(widgets, true), kind, delta);
  next.splice(at, 0, PINNED_WIDGET);
  return next;
}

// The scrolling row's mask: a fade at each edge with more past it.
export function edgeFade(start: boolean, end: boolean): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const mask = `linear-gradient(to right, ${start ? 'transparent' : '#000'} 0, #000 ${start ? EDGE_FADE_PX : 0}px, #000 calc(100% - ${end ? EDGE_FADE_PX : 0}px), ${end ? 'transparent' : '#000'} 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

export type ZoneOverflow = {
  // The Filter holds the zone's start.
  pinned: boolean;
  // More past the row's start, or its end.
  start: boolean;
  end: boolean;
};

const QUIET: ZoneOverflow = { pinned: false, start: false, end: false };

// Measures the zone as it and its row change size (ResizeObserver: the row's content, a count growing a digit, a chip
// added to the Filter) and as the row scrolls; a state is set only when it changes, so a scroll redraws nothing until
// an edge's fade comes or goes. `has`: the board has the Filter widget (nothing to pin without it); `shown`: it has
// widgets, so the row is drawn.
export function useZoneOverflow(
  zone: RefObject<HTMLElement | null>,
  row: RefObject<HTMLElement | null>,
  has: boolean,
  shown: boolean,
): ZoneOverflow {
  const [state, setState] = useState<ZoneOverflow>(QUIET);
  useLayoutEffect(() => {
    const z = zone.current;
    const r = row.current;
    if (!z || !r) return;
    const measure = () =>
      setState((was) => {
        // What the widgets want across, however they are laid out now: the row's content, plus the pinned Filter and
        // its gap (the zone's width the row leaves), so pinning never changes the answer and never flips back.
        const need = r.scrollWidth + z.clientWidth - r.clientWidth;
        const room = z.clientWidth;
        const pinned = has && (was.pinned ? need > room - UNPIN_SLACK_PX : need > room + 1);
        const start = r.scrollLeft > 1;
        const end = r.scrollLeft + r.clientWidth < r.scrollWidth - 1;
        return was.pinned === pinned && was.start === start && was.end === end
          ? was
          : { pinned, start, end };
      });
    measure();
    r.addEventListener('scroll', measure, { passive: true });
    const seen = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    seen?.observe(z);
    seen?.observe(r);
    for (const el of r.children) seen?.observe(el);
    return () => {
      r.removeEventListener('scroll', measure);
      seen?.disconnect();
    };
  }, [zone, row, has, shown, state.pinned]);
  return state;
}
