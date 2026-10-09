// A maximised board's sideways auto-scroll while a card is dragged (docs/specs/026-plan/plan-board.md "Maximised
// board"): near the left or right edge of the columns' viewport the columns scroll, faster the closer the pointer is to
// the edge, and not at all past the end. Under reduced motion it still scrolls, at a constant gentle speed. Pure.

// How deep the edge zone reaches into the viewport, and the fastest step per frame (blueprint DEFAULTS).
export const EDGE_SCROLL_ZONE_PX = 56;
export const EDGE_SCROLL_MAX_PX = 18;
// The one speed under reduced motion: a third of the fastest, no ramp.
export const EDGE_SCROLL_REDUCED_PX = 6;

// The step this frame for a pointer at `x` over a viewport spanning `left`..`right` (screen px): negative scrolls left,
// positive right, 0 outside both zones. The ramp is quadratic, so it starts slow at the zone's inner edge.
export function edgeScrollStep(
  x: number,
  viewport: { left: number; right: number },
  reducedMotion = false,
): number {
  const width = viewport.right - viewport.left;
  const zone = Math.min(EDGE_SCROLL_ZONE_PX, width / 4);
  if (zone <= 0) return 0;
  const intoLeft = viewport.left + zone - x;
  const intoRight = x - (viewport.right - zone);
  const depth = intoLeft > 0 ? intoLeft : intoRight > 0 ? intoRight : 0;
  if (depth <= 0) return 0;
  const sign = intoLeft > 0 ? -1 : 1;
  if (reducedMotion) return sign * EDGE_SCROLL_REDUCED_PX;
  const t = Math.min(1, depth / zone);
  return sign * Math.max(1, Math.round(EDGE_SCROLL_MAX_PX * t * t));
}

// The step clamped to what is left to scroll: 0 at the ends.
export function clampScrollStep(
  step: number,
  scroll: { scrollLeft: number; scrollWidth: number; clientWidth: number },
): number {
  const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const next = Math.min(max, Math.max(0, scroll.scrollLeft + step));
  return next - scroll.scrollLeft;
}
