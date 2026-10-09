'use client';

// Runs edge-auto-scroll.ts on a scroll container while `active` (a card dragged on a maximised board): it follows the
// pointer (mouse, pen or touch) on the window and steps the container once per animation frame while the pointer is in
// an edge zone. Nothing runs while `active` is false, so a plain hover never scrolls.
import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { clampScrollStep, edgeScrollStep } from './edge-auto-scroll';

export function useEdgeAutoScroll(scroller: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const el = scroller.current;
    if (!active || !el) return;
    const reduced = prefersReducedMotion();
    let x: number | null = null;
    let frame = 0;
    const tick = () => {
      frame = 0;
      if (x === null) return;
      const rect = el.getBoundingClientRect();
      const step = clampScrollStep(edgeScrollStep(x, rect, reduced), el);
      if (step === 0) return;
      el.scrollLeft += step;
      frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scroller, active]);
}
