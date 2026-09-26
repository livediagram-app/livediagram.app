'use client';

import { useLayoutEffect, type RefObject } from 'react';

// The words under a box fit the BOX (docs/specs/021-event-storming/event-storming.md Phase 9): as large as the
// default, as small as the floor, at most two lines. Past the floor the
// two-line clamp cuts what is left; the full words are in the tooltip.
export const WORDS_FONT = { max: 11, min: 7, step: 0.5, lines: 2, leading: 1.25 } as const;

// The largest size, stepping down from the default, at which `fits` holds.
export function fitFontPx(fits: (px: number) => boolean): number {
  for (let px: number = WORDS_FONT.max; px > WORDS_FONT.min; px -= WORDS_FONT.step) {
    if (fits(px)) return px;
  }
  return WORDS_FONT.min;
}

// One line of the chip, padding included, in on-screen pixels: the part of it
// that sits INSIDE the box. A second line hangs below the box, never over the
// handwriting.
export const lineHeightPx = (px: number): number => px * WORDS_FONT.leading + 4;

// Fit the element's font to its own width, again whenever the words or its
// width change (a resize, a zoom, the window).
export function useFitText(
  ref: RefObject<HTMLElement | null>,
  text: string,
  onFit: (px: number) => void,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const px = fitFontPx((size) => {
        el.style.fontSize = `${size}px`;
        // Unclamped height: how many lines the words would really take.
        el.style.webkitLineClamp = 'unset';
        const lines = Math.round((el.scrollHeight - 4) / (size * WORDS_FONT.leading));
        el.style.webkitLineClamp = '';
        return lines <= WORDS_FONT.lines;
      });
      el.style.fontSize = `${px}px`;
      onFit(px);
    };
    fit();
    if (typeof ResizeObserver !== 'function') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, text]);
}
