'use client';

// Keeps a board's header buttons on screen (docs/specs/026-plan/plan-board.md "On a phone"): when the board runs
// past the canvas's right edge (zoomed in on a phone), the group slides left to stay within it, never past the
// board's own left edge. The canvas is a transformed layer, so CSS sticky cannot do this: the hook re-measures
// on every pan or zoom (the viewport store) and canvas resize, one frame at a time, and writes the shift straight
// onto the element (no re-render). `data-shifted` is set while it is moved, so the host can give it a backdrop.
import { useEffect, type RefObject } from 'react';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';

// The gap kept between the group and the canvas's edge, in screen px.
export const KEEP_ON_SCREEN_MARGIN_PX = 8;

// How far (in the element's own px, negative = left) a group should move to keep its right edge within
// `visibleRight`, without its left edge passing `minLeft`; all in screen px, `scale` screen px per own px.
export function keepOnScreenShift(
  group: { left: number; right: number },
  visibleRight: number,
  minLeft: number,
  scale: number,
): number {
  if (scale <= 0 || group.right <= visibleRight) return 0;
  const want = visibleRight - group.right;
  const most = Math.min(0, minLeft - group.left);
  return Math.max(want, most) / scale;
}

export function useKeepOnScreen(
  group: RefObject<HTMLElement | null>,
  bounds: RefObject<HTMLElement | null>,
): void {
  // Outside an editor's canvas (a slide) there is no view to follow, and nothing to keep on screen.
  const viewport = useViewportStoreIfAny();
  useEffect(() => {
    const el = group.current;
    const box = bounds.current;
    const main = el?.closest('main');
    if (!viewport || !el || !box || !main) return;
    let frame: number | null = null;
    let shift = 0;
    const measure = () => {
      frame = null;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      // Where the group would sit unmoved.
      const natural = { left: r.left - shift * scale, right: r.right - shift * scale };
      const next = keepOnScreenShift(
        natural,
        main.getBoundingClientRect().right - KEEP_ON_SCREEN_MARGIN_PX,
        box.getBoundingClientRect().left + KEEP_ON_SCREEN_MARGIN_PX * scale,
        scale,
      );
      if (next === shift) return;
      shift = next;
      el.style.transform = shift ? `translateX(${shift}px)` : '';
      if (shift) el.dataset.shifted = '';
      else delete el.dataset.shifted;
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    schedule();
    const unsubscribe = viewport.subscribe(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(main);
    observer.observe(box);
    return () => {
      unsubscribe();
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [group, bounds, viewport]);
}
