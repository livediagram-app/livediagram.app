'use client';

// Which rows of a long, fixed-height list are on screen, so only those (and a few either side) are in the
// DOM. It reads the list's place in the viewport, so it works whether the page or a host's container
// scrolls: a capture-phase scroll listener hears any scroller, and the work per scroll is one rect read
// and a state update only when the window moves. Hosts without layout (tests, server) get the first
// screenful.

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const OVERSCAN = 8;
// Without a viewport to measure: a screen's worth.
const FALLBACK_VIEWPORT = 900;

export type WindowRange = { start: number; end: number };

export function useWindowedRange(
  ref: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number,
): WindowRange {
  const [range, setRange] = useState<WindowRange>(() => ({
    start: 0,
    end: Math.min(count, Math.ceil(FALLBACK_VIEWPORT / rowHeight) + OVERSCAN),
  }));

  useIsoLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const viewport = window.innerHeight || FALLBACK_VIEWPORT;
      const first = Math.floor(Math.max(0, -top) / rowHeight);
      const last = Math.ceil(Math.max(0, viewport - top) / rowHeight);
      const start = Math.max(0, Math.min(count, first - OVERSCAN));
      const end = Math.max(start, Math.min(count, last + OVERSCAN));
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, count, rowHeight]);

  return range;
}
