'use client';

import { useLayoutEffect, useRef } from 'react';
import { glideEase, TOUR_DIM, TOUR_GLIDE_MS } from './tour-motion';
import type { TourTargetRect } from './useTourEngine';

// The hole's corner: a soft rectangle, never rounder than half its height (a slim toolbar reads as a pill).
const HOLE_RADIUS = 10;
// The dim's outer edge: far past any screen, so the clip never needs the viewport's size.
const FAR = 100000;

type Box = { x: number; y: number; w: number; h: number };

/** The dim's clip: the whole screen less a rounded hole. */
export function holePath({ x, y, w, h }: Box): string {
  const r = Math.min(HOLE_RADIUS, h / 2, w / 2);
  const outer = `M${-FAR} ${-FAR}H${FAR}V${FAR}H${-FAR}Z`;
  const hole =
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}` +
    `A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return `path(evenodd, '${outer}${hole}')`;
}

const lerp = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

// Read only from an effect, so always in the browser.
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// The spotlight around a step's target (docs/specs/007-editor/pages-tour.md "Look and motion"): the screen dimmed around
// the target, the target itself clear, with no outline drawn round it. pointer-events-none, so whatever is highlighted
// stays usable (unless the tour's shield is up); portalled menus (higher z / later portals) paint above the dim.
//
// One full-screen layer with a rounded hole clipped out of it. A glide is one tween, frame by frame, that moves and
// resizes the hole with no render during it (a hole and an outline animated on different threads pulled apart and
// stuttered). Between glides it follows the target exactly. One spotlight for the whole run (mounting one per step
// left every earlier step's on screen in the production build); it fades in when it first shows.
export function TourSpotlight({
  rect,
  gliding,
  pad,
  layerClass,
}: {
  // The target's rect; null hides the spotlight (no target yet, or one gone).
  rect: TourTargetRect | null;
  // A glide to a new step's target is under way: the change to `rect` is travelled, not jumped.
  gliding: boolean;
  pad: number;
  layerClass: string;
}) {
  const dimRef = useRef<HTMLDivElement>(null);
  // What is drawn now, mid-glide included, so a glide always starts from where the eye is.
  const drawn = useRef<Box | null>(null);
  const frame = useRef(0);

  const target: Box | null = rect
    ? {
        x: Math.round(rect.left - pad),
        y: Math.round(rect.top - pad),
        w: Math.round(rect.width + pad * 2),
        h: Math.round(rect.height + pad * 2),
      }
    : null;
  const key = target ? `${target.x},${target.y},${target.w},${target.h}` : '';

  useLayoutEffect(() => {
    if (!target) {
      drawn.current = null;
      return;
    }
    const paint = (b: Box) => {
      drawn.current = b;
      if (dimRef.current) dimRef.current.style.clipPath = holePath(b);
    };
    cancelAnimationFrame(frame.current);
    const from = drawn.current;
    if (!gliding || !from || prefersReducedMotion()) {
      paint(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / TOUR_GLIDE_MS);
      paint(t >= 1 ? target : lerp(from, target, glideEase(t)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // `key` stands for the target box.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [key, gliding]);

  if (!target) return null;
  return (
    // Fades in when it first shows, never on a glide.
    <div
      ref={dimRef}
      aria-hidden
      data-tour-spotlight=""
      className={`pointer-events-none fixed left-0 top-0 h-screen w-screen ${layerClass} animate-tour-dim-in`}
      style={{ background: TOUR_DIM }}
    />
  );
}
