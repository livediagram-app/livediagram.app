'use client';

// Where the floating draft bar stands (docs/specs/030-knowledgebase/editing.md "The buttons"): the bottom-right corner of
// the article zone, the reading area between the sidebar and the rail, as fixed offsets from the window's edges. Read
// from the zone's box when it is laid out, on a resize of the zone or the window, and nowhere else: no work per
// keystroke or scroll.
import { useEffect, useState } from 'react';

const ZONE = '[data-canvas-root]';
// Room between the bar and the zone's edges (px).
const INSET = 24;

export type ZoneCorner = { right: number; bottom: number };

/** The bar's offsets from the window's right and bottom edges, for a zone box in a window of the given size. */
export function cornerOf(
  zone: Pick<DOMRect, 'right' | 'bottom'>,
  window: { width: number; height: number },
): ZoneCorner {
  return {
    right: Math.max(INSET, window.width - zone.right + INSET),
    bottom: Math.max(INSET, window.height - Math.min(zone.bottom, window.height) + INSET),
  };
}

export function useArticleZoneCorner(active: boolean): ZoneCorner {
  const [corner, setCorner] = useState<ZoneCorner>({ right: INSET, bottom: INSET });
  useEffect(() => {
    if (!active) return;
    const zone = document.querySelector<HTMLElement>(ZONE);
    if (!zone) return;
    const read = () =>
      setCorner((was) => {
        const next = cornerOf(zone.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        return next.right === was.right && next.bottom === was.bottom ? was : next;
      });
    read();
    const watch = new ResizeObserver(read);
    watch.observe(zone);
    window.addEventListener('resize', read);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [active]);
  return corner;
}
