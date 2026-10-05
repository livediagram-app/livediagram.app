// A view moved somewhere by the app rather than by a hand (a page framed from its navigator, an
// element scrolled into view): it glides there, an ease-out over VIEW_GLIDE_MS, so the eye follows
// where it went (docs/specs/007-editor/illustrate-pages.md "The page navigator"). Under reduced
// motion (the OS setting or the app's Reduce Motion, the `.reduce-motion` class) it lands at once.

import { prefersReducedMotion } from './motion-preference';

// The glide's length (ms): the scroll-into-view's long-standing duration.
export const VIEW_GLIDE_MS = 280;

export type ViewPose = { zoom: number; offset: { x: number; y: number } };

const reducedMotion = prefersReducedMotion;

/**
 * Moves the view from `from` to `to`, a frame at a time; returns a cancel, for a later move that
 * starts from wherever this one has got to.
 */
export function glideViewport(
  from: ViewPose,
  to: ViewPose,
  set: { zoom: (zoom: number) => void; offset: (offset: { x: number; y: number }) => void },
  ms = VIEW_GLIDE_MS,
): () => void {
  const sameZoom = from.zoom === to.zoom;
  if (reducedMotion() || ms <= 0) {
    if (!sameZoom) set.zoom(to.zoom);
    set.offset(to.offset);
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
    set.offset({
      x: from.offset.x + (to.offset.x - from.offset.x) * e,
      y: from.offset.y + (to.offset.y - from.offset.y) * e,
    });
    if (!sameZoom) set.zoom(from.zoom + (to.zoom - from.zoom) * e);
    raf = k < 1 ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
