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

import { POPOVER_VIEWPORT_MARGIN, shiftIntoRange } from '@liveworkspace/ui';

// The px gap floating UI keeps from the viewport edge. Shared by the clamp
// below and by the popovers / menus / toolbars that run their own edge-aware
// positioning. Sourced from @liveworkspace/ui so the inset is one value across
// the package boundary (the hints in packages/ui use the same constant);
// re-exported under the historical name so existing importers are unchanged.
export const VIEWPORT_EDGE_MARGIN = POPOVER_VIEWPORT_MARGIN;

type ViewportAdjust = { x: number; y: number };

/** A box's edges on screen: a DOMRect, or a box measured with its title pill (useEdgeAwarePlacement's measuredBox). */
type ScreenBox = { left: number; right: number; top: number; bottom: number };

// Each axis is kept in by @liveworkspace/ui's shiftIntoRange, the one copy of that arithmetic every anchored overlay
// uses (keepOnScreen): a box longer than the room keeps its start edge in.

export function clampToViewport(
  rect: ScreenBox,
  prevAdjust: ViewportAdjust,
  margin = VIEWPORT_EDGE_MARGIN,
): ViewportAdjust {
  // "Natural" rect edges: where the box would sit with no clamp.
  return {
    x: shiftIntoRange(
      rect.left - prevAdjust.x,
      rect.right - prevAdjust.x,
      window.innerWidth,
      margin,
    ),
    y: shiftIntoRange(
      rect.top - prevAdjust.y,
      rect.bottom - prevAdjust.y,
      window.innerHeight,
      margin,
    ),
  };
}
