'use client';

// The panel's rail scrolls only when its entries are really taller than it (one-explorer.md "The editors' panel"):
// on a short window the current item's card drops its picture first, and takes it back once the whole card fits.
//
// It measures the rail's content (its children's span plus its padding) against the rail's own height on each
// layout change (a ResizeObserver on the rail and its children), and remembers the picture's height while it
// shows, so a tight rail knows whether the picture would fit again. Without layout (tests, server) nothing is
// measured and the card keeps its picture.

import { createContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The card's picture height in the rail: null at its full size, a smaller height when only that fits, 0 when it is
 *  dropped. The card reads it to size or leave out the picture. */
export const RailPicture = createContext<number | null>(null);

/** The picture's full height (the card's h-24) and the least it shrinks to before it drops. */
export const RAIL_PICTURE_FULL = 96;
export const RAIL_PICTURE_MIN = 48;

/** The picture's height for the room there is: the rail's content without the picture (`content` less `shown`, the
 *  picture and its gap as drawn now) against the room. Full when it fits, shrunk to what is left down to the minimum,
 *  else dropped (0). Half a pixel of slack for subpixel layout. Exported for the tests. */
export function railPicture({
  content,
  room,
  shown,
  gap,
}: {
  // The rail's content now, padding included.
  content: number;
  // The rail's inner height (clientHeight).
  room: number;
  // The picture's height plus its gap as drawn now (0 when dropped).
  shown: number;
  // The card's gap that comes with the picture.
  gap: number;
}): number | null {
  const spare = room + 0.5 - (content - shown) - gap;
  if (spare >= RAIL_PICTURE_FULL) return null;
  // A shrunk picture keeps a pixel spare: subpixel rounding otherwise left the rail 1 px over, and scrolling.
  const fit = Math.floor(spare - 1.5);
  return fit >= RAIL_PICTURE_MIN ? fit : 0;
}

/** The rail's content height: its first child's top to its last child's bottom, plus its own padding. */
export function railContent(nav: HTMLElement): number {
  const kids = nav.children;
  const first = kids[0];
  const last = kids[kids.length - 1];
  if (!first || !last) return 0;
  const style = getComputedStyle(nav);
  return (
    last.getBoundingClientRect().bottom -
    first.getBoundingClientRect().top +
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0)
  );
}

/** The card's picture height for the rail (railPicture): null at full size. `layoutKey` changes when the rail's
 *  entries do. */
export function useRailFit(
  navRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  layoutKey: string,
): number | null {
  const [picture, setPicture] = useState<number | null>(null);
  const gap = useRef(6);
  useIsoLayoutEffect(() => {
    const nav = navRef.current;
    if (!enabled || !nav || typeof ResizeObserver === 'undefined') {
      setPicture(null);
      return;
    }
    const measure = () => {
      const pic = nav.querySelector<HTMLElement>('[data-current-picture]');
      let shown = 0;
      if (pic && pic.getClientRects().length > 0) {
        // The card's gap under the picture goes with it (the picture always sits in the card).
        gap.current = parseFloat(getComputedStyle(pic.parentElement ?? pic).rowGap) || 0;
        shown = pic.getBoundingClientRect().height + gap.current;
      }
      setPicture(
        railPicture({ content: railContent(nav), room: nav.clientHeight, shown, gap: gap.current }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    for (const kid of nav.children) observer.observe(kid);
    measure();
    return () => observer.disconnect();
  }, [navRef, enabled, layoutKey]);
  return enabled ? picture : null;
}
