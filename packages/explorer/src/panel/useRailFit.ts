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

/** True inside a rail that has dropped the card's picture: the card reads it to leave the picture out. */
export const RailTight = createContext(false);

/** Whether the rail goes without the card's picture: the content with the picture (put back when it is hidden) is
 *  taller than the room. Half a pixel of slack for subpixel layout. Exported for the tests. */
export function railTight({
  tight,
  content,
  room,
  picture,
}: {
  tight: boolean;
  // The rail's content now, padding included.
  content: number;
  // The rail's inner height (clientHeight).
  room: number;
  // The picture's height plus the gap it brings, measured while it showed (0 before).
  picture: number;
}): boolean {
  return content + (tight ? picture : 0) > room + 0.5;
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

/** True while the rail should drop the card's picture. `layoutKey` changes when the rail's entries do. */
export function useRailFit(
  navRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  layoutKey: string,
): boolean {
  const [tight, setTight] = useState(false);
  const picture = useRef(0);
  useIsoLayoutEffect(() => {
    const nav = navRef.current;
    if (!enabled || !nav || typeof ResizeObserver === 'undefined') {
      setTight(false);
      return;
    }
    const measure = () => {
      const pic = nav.querySelector<HTMLElement>('[data-current-picture]');
      if (pic && pic.getClientRects().length > 0) {
        // The card's gap under the picture goes with it (the picture always sits in the card).
        const gap = parseFloat(getComputedStyle(pic.parentElement ?? pic).rowGap) || 0;
        picture.current = pic.getBoundingClientRect().height + gap;
      }
      const content = railContent(nav);
      setTight((was) =>
        railTight({ tight: was, content, room: nav.clientHeight, picture: picture.current }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    for (const kid of nav.children) observer.observe(kid);
    measure();
    return () => observer.disconnect();
  }, [navRef, enabled, layoutKey]);
  return enabled && tight;
}
