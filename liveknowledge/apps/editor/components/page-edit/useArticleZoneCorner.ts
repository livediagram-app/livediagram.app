'use client';

// Where the floating Edit button and draft bar stand (docs/specs/030-knowledgebase/editing.md "The buttons"): the
// bottom right of the document's area (owner, 2026-11-21: "bottom right of that white zone"), left of the rail beside
// it and above the footer under it. As fixed offsets from the window's edges, read from the area's box on a resize of
// the area, the rail or the window, and nowhere else: no work per keystroke or scroll.
import { useEffect, useState } from 'react';

const ZONE = '[data-page-scroller]';
const RAIL = '[data-page-rail="docked"]';
// Room between the buttons and the area's right and bottom edges (px).
const INSET = 24;

export type ZoneCorner = { right: number; bottom: number };

/** The offsets from the window's right and bottom edges: INSET inside the area's bottom right corner, kept left of a
 *  docked rail and inside the window. */
export function cornerOf(
  edges: { zone: number; rail?: number | undefined; bottom?: number },
  window: { width: number; height: number },
): ZoneCorner {
  const edge = Math.min(edges.zone, edges.rail ?? Infinity, window.width);
  const floor = Math.min(edges.bottom ?? window.height, window.height);
  return { right: window.width - edge + INSET, bottom: window.height - floor + INSET };
}

export function useArticleZoneCorner(active: boolean): ZoneCorner {
  const [corner, setCorner] = useState<ZoneCorner>({ right: INSET, bottom: INSET });
  useEffect(() => {
    if (!active) return;
    const zone = document.querySelector<HTMLElement>(ZONE);
    if (!zone) return;
    const read = () => {
      // Looked up at each read: the rail docks and undocks as the window crosses its width, and one read when the
      // effect ran would hold a rail since taken away (its box all zeros, the buttons pushed off the left edge).
      const rail = document.querySelector<HTMLElement>(RAIL);
      const box = zone.getBoundingClientRect();
      const next = cornerOf(
        // Its inner box: the scrollbar's gutter is not the white page area.
        {
          zone: box.left + zone.clientWidth,
          bottom: box.top + zone.clientHeight,
          rail: rail?.getBoundingClientRect().left,
        },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setCorner((was) => (next.right === was.right && next.bottom === was.bottom ? was : next));
    };
    read();
    const watch = new ResizeObserver(read);
    // The zone's own size changes as the rail docks or undocks beside it (the scroller ends short of a docked rail).
    watch.observe(zone);
    window.addEventListener('resize', read);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [active]);
  return corner;
}
