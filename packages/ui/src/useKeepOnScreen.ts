'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { keepOnScreen, type OnScreenShift } from './popover';

const NO_SHIFT: OnScreenShift = { x: 0, y: 0 };

export type KeepOnScreenOptions = {
  // Screen pixels per unit of the overlay's own translate: the canvas zoom for an overlay inside a zoomed canvas,
  // so the shift comes back in the units it is applied in. Read when it measures, so a zoom alone never re-measures.
  scale?: number;
  // What it hangs from, for the flip above or below (keepOnScreen's `anchor`): the element, or its top and bottom on
  // screen for an anchor with no element of its own (a cell drawn on a grid).
  anchor?: () => Element | { top: number; bottom: number } | null | undefined;
  // An overlay always mounted and shown by CSS (a hover line on `group-hover`) has no open of its own: it measures
  // when the pointer enters, or focus moves into, its parent, the moment it shows.
  revealOn?: 'parent';
};

/**
 * The shift that keeps an anchored overlay on screen (keepOnScreen), measured once per open: when `open` turns
 * truthy or changes (a new hover, another cell), and on each reveal with `revealOn`. Never per frame or per pointer
 * move. The caller applies it as a translate, so the overlay keeps its own placement and only slides or flips when it
 * would leave the screen. A re-measure subtracts the shift already applied, so one no longer needed returns to zero.
 */
export function useKeepOnScreen(
  ref: RefObject<HTMLElement | null>,
  open: unknown,
  options: KeepOnScreenOptions = {},
): OnScreenShift {
  const [shift, setShift] = useState(NO_SHIFT);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const { revealOn } = options;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const { scale = 1, anchor } = latest.current;
      const r = el.getBoundingClientRect();
      const from = anchor?.();
      const a = from && 'getBoundingClientRect' in from ? from.getBoundingClientRect() : from;
      setShift((prev) => {
        const s = keepOnScreen(
          {
            left: r.left - prev.x * scale,
            right: r.right - prev.x * scale,
            top: r.top - prev.y * scale,
            bottom: r.bottom - prev.y * scale,
          },
          { width: window.innerWidth, height: window.innerHeight },
          { anchor: a ?? undefined },
        );
        const next = { x: s.x / scale, y: s.y / scale };
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    if (open) place();
    const host = revealOn === 'parent' ? el.parentElement : null;
    host?.addEventListener('pointerenter', place);
    host?.addEventListener('focusin', place);
    return () => {
      host?.removeEventListener('pointerenter', place);
      host?.removeEventListener('focusin', place);
    };
  }, [ref, open, revealOn]);
  return shift;
}

// The shift as a CSS translate, or undefined when there is none, to compose into an overlay's `transform`.
export function onScreenTranslate({ x, y }: OnScreenShift): string | undefined {
  return x || y ? `translate(${x}px, ${y}px)` : undefined;
}
