'use client';

// The sideways swipe of a phone board that shows one column a screen (docs/specs/026-plan/plan-board.md "On a phone",
// "A column changes only on a swipe meant for it"). The body is touch-action: pan-y, so the browser scrolls it down
// natively and never sideways; this hook carries the columns under a finger that went across and, on release, moves
// one column or glides back (components/plan/phone-swipe.ts). A touch that went down is left to the browser to its end.
//
// Cost: every listener is passive, so a vertical scroll never waits on it. The columns' stops are read once, when a
// touch settles across; each move after that only writes scrollLeft, coalesced to one write a frame.
import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { centredScrollLeft } from '@/components/plan/phone-board';
import {
  addSample,
  landingLeft,
  nearestStop,
  sampleVelocity,
  swipeAxis,
  swipeStep,
  type SwipeSample,
} from '@/components/plan/phone-swipe';
import { cardHeld } from './usePlanCardDrag';

// The marker each phone column snaps to (PlanBoardView), over the column's full width.
const SNAP_MARKER = '[data-plan-snap]';
// How long a release's glide may take before the snapping comes back regardless (no scrollend in older browsers).
const GLIDE_FALLBACK_MS = 600;

type Gesture = {
  x0: number;
  y0: number;
  across: boolean;
  left0: number;
  maxLeft: number;
  stops: number[];
  from: number;
  width: number;
  samples: SwipeSample[];
  dx: number;
  dy: number;
};

// The columns' centred scrollLefts and a column's width, read once a swipe settles across.
function measure(body: HTMLElement): { stops: number[]; width: number } {
  const b = body.getBoundingClientRect();
  const frame = {
    left: b.left + body.clientLeft,
    scrollLeft: body.scrollLeft,
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  };
  let width = 0;
  const stops = Array.from(body.querySelectorAll<HTMLElement>(SNAP_MARKER), (m) => {
    const r = m.getBoundingClientRect();
    width = r.width;
    return centredScrollLeft(frame, { left: r.left, width: r.width });
  });
  return { stops, width };
}

export function usePhoneColumnSwipe(
  bodyRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  carrying: boolean,
): void {
  const carryingRef = useRef(carrying);
  useEffect(() => {
    carryingRef.current = carrying;
  }, [carrying]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!enabled || !body) return;
    let g: Gesture | null = null;
    let frame = 0;
    let restore = 0;

    const snapBack = () => {
      if (restore) window.clearTimeout(restore);
      restore = 0;
      body.removeEventListener('scrollend', snapBack);
      body.style.scrollSnapType = '';
    };
    const write = () => {
      frame = 0;
      if (g?.across) body.scrollLeft = Math.max(0, Math.min(g.maxLeft, g.left0 - g.dx));
    };
    // Off the columns: a glide to the column the swipe lands on (or the one it left), snapping again once it ends.
    const land = (step: -1 | 0 | 1) => {
      const s = g;
      g = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (!s?.across) return;
      const left = landingLeft(s.stops, s.from, step);
      if (Math.abs(body.scrollLeft - left) < 1) {
        snapBack();
        return;
      }
      body.addEventListener('scrollend', snapBack);
      restore = window.setTimeout(snapBack, GLIDE_FALLBACK_MS);
      body.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };
    // Two fingers or a card picked up: the swipe stands down, the columns gliding back.
    const standDown = () => land(0);

    const onStart = (e: TouchEvent) => {
      if (g?.across) standDown();
      const t = e.touches[0]!;
      g =
        e.touches.length === 1
          ? {
              x0: t.clientX,
              y0: t.clientY,
              across: false,
              left0: 0,
              maxLeft: 0,
              stops: [],
              from: 0,
              width: 0,
              samples: [],
              dx: 0,
              dy: 0,
            }
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (!g) return;
      if (e.touches.length !== 1 || carryingRef.current || cardHeld()) {
        standDown();
        return;
      }
      const t = e.touches[0]!;
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (!g.across) {
        const axis = swipeAxis(dx, dy);
        if (axis === null) return;
        // Went down: the browser scrolls it, and nothing sideways changes the column for the rest of this touch.
        if (axis === 'y') {
          g = null;
          return;
        }
        const { stops, width } = measure(body);
        if (stops.length < 2) {
          g = null;
          return;
        }
        if (restore) snapBack();
        body.style.scrollSnapType = 'none';
        g.across = true;
        g.left0 = body.scrollLeft;
        g.maxLeft = body.scrollWidth - body.clientWidth;
        g.stops = stops;
        g.width = width;
        g.from = nearestStop(stops, g.left0);
      }
      g.dx = dx;
      g.dy = dy;
      addSample(g.samples, e.timeStamp, t.clientX);
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onEnd = (e: TouchEvent) => {
      if (!g?.across) {
        if (e.touches.length === 0) g = null;
        return;
      }
      land(swipeStep(g.dx, g.dy, sampleVelocity(g.samples, e.timeStamp), g.width));
    };

    const opts = { passive: true } as const;
    body.addEventListener('touchstart', onStart, opts);
    body.addEventListener('touchmove', onMove, opts);
    body.addEventListener('touchend', onEnd, opts);
    body.addEventListener('touchcancel', standDown, opts);
    return () => {
      body.removeEventListener('touchstart', onStart);
      body.removeEventListener('touchmove', onMove);
      body.removeEventListener('touchend', onEnd);
      body.removeEventListener('touchcancel', standDown);
      if (frame) cancelAnimationFrame(frame);
      snapBack();
    };
  }, [bodyRef, enabled]);
}
