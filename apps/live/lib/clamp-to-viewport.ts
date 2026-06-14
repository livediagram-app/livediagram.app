// Floating-popover viewport clamp. Three editor popovers (TabBar's
// per-tab menu, PortalMenu, TabLinkPicker) all need to nudge their
// portaled box back inside the viewport when the anchor lands too
// close to an edge. Each had its own copy of the same math, and all
// three carried the same self-referential bug: a clamp computed
// against the box's current rect can never relax once applied,
// because the box has already been translated into-frame and the
// next measurement reports "no overflow" forever.
//
// One helper, two changes from the original copies:
//
// - The natural (pre-translate) edges are derived by subtracting
//   the caller's previous adjust from the live rect. Overflow is
//   checked against those, so a clamp that's no longer needed
//   shrinks back to zero on the next re-measure.
// - Returns the new adjust unconditionally; the caller compares
//   against its previous state to avoid setState-loops.

// The px gap floating UI keeps from the viewport edge. Shared by the clamp
// below and by the popovers / menus / toolbars that run their own edge-aware
// positioning, so the inset is defined once instead of copied per component.
export const VIEWPORT_EDGE_MARGIN = 8;

export type ViewportAdjust = { x: number; y: number };

export function clampToViewport(
  rect: DOMRect,
  prevAdjust: ViewportAdjust,
  margin = VIEWPORT_EDGE_MARGIN,
): ViewportAdjust {
  // "Natural" rect edges: where the box would sit with no clamp.
  const naturalLeft = rect.left - prevAdjust.x;
  const naturalRight = rect.right - prevAdjust.x;
  const naturalTop = rect.top - prevAdjust.y;
  const naturalBottom = rect.bottom - prevAdjust.y;
  let dx = 0;
  let dy = 0;
  if (naturalLeft < margin) dx = margin - naturalLeft;
  else if (naturalRight > window.innerWidth - margin) {
    dx = window.innerWidth - margin - naturalRight;
  }
  if (naturalTop < margin) dy = margin - naturalTop;
  else if (naturalBottom > window.innerHeight - margin) {
    dy = window.innerHeight - margin - naturalBottom;
  }
  return { x: dx, y: dy };
}
