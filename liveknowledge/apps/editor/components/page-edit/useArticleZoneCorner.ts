'use client';

// Where the floating Edit button and draft bar stand (docs/specs/030-knowledgebase/editing.md "The buttons"): the
// bottom right of the document itself, the reading column's right edge (owner, 2026-11-21: "meant to stay bottom
// right of the actual document"), never over the rail beside it. As fixed offsets from the window's edges, read from
// the column's box when it is laid out, on a resize of the area, the column or the rail, or the window, and nowhere
// else: no work per keystroke or scroll.
import { useEffect, useState } from 'react';

const ZONE = '[data-canvas-root]';
const COLUMN = '.article-flow';
const RAIL = '[data-page-rail="docked"]';
// Room between the buttons and the window's bottom, and inside the column's edge (px).
const INSET = 24;

export type ZoneCorner = { right: number; bottom: number };

/**
 * The offsets from the window's right and bottom edges: at the document column's right edge (or the area's, with no
 * column yet), kept left of a docked rail and inside the window.
 */
export function cornerOf(
  edges: { column?: number | undefined; zone: number; rail?: number | undefined; bottom?: number },
  window: { width: number; height: number },
): ZoneCorner {
  const limit = Math.min(edges.zone, edges.rail ?? Infinity) - INSET;
  const edge = Math.min(edges.column ?? limit, limit);
  // Above whatever runs along the window's foot under the area (the footer's tab bar).
  const floor = Math.min(edges.bottom ?? window.height, window.height);
  return { right: Math.max(INSET, window.width - edge), bottom: window.height - floor + INSET };
}

/** `page` re-reads the column when another page (and its column) opens. */
export function useArticleZoneCorner(active: boolean, page?: string): ZoneCorner {
  const [corner, setCorner] = useState<ZoneCorner>({ right: INSET, bottom: INSET });
  useEffect(() => {
    if (!active) return;
    const zone = document.querySelector<HTMLElement>(ZONE);
    if (!zone) return;
    const watch = new ResizeObserver(() => read());
    let watched: HTMLElement | null = null;
    let tries = 0;
    let retry: number | undefined;
    const read = () => {
      const column = zone.querySelector<HTMLElement>(COLUMN);
      const rail = document.querySelector<HTMLElement>(RAIL);
      // The page's writing mounts after the page opens (and again on entering or leaving edit mode): look again a
      // few times until it is there, then follow its size.
      if (column && column !== watched) {
        watched = column;
        watch.observe(column);
      } else if (!column && tries++ < 20) retry = window.setTimeout(read, 150);
      const next = cornerOf(
        {
          zone: zone.getBoundingClientRect().right,
          bottom: zone.getBoundingClientRect().bottom,
          column: column?.getBoundingClientRect().right,
          rail: rail?.getBoundingClientRect().left,
        },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setCorner((was) => (next.right === was.right && next.bottom === was.bottom ? was : next));
    };
    watch.observe(zone);
    const rail = document.querySelector<HTMLElement>(RAIL);
    if (rail) watch.observe(rail);
    // A frame after the change that set this off (edit mode's writing swaps in), then whenever a box moves.
    const frame = requestAnimationFrame(read);
    window.addEventListener('resize', read);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      watch.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [active, page]);
  return corner;
}
