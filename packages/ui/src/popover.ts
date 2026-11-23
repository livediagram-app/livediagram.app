// Shared primitives for portal-positioned floating UI (tooltips, hover
// cards, confirm popovers, note popovers, edge-aware menus): the one
// viewport-edge inset and the one-dimensional clamp every floating box uses.
//
// Note: each floating element keeps its OWN width/height (a tooltip pill,
// a hover card, a confirm popover, and a note editor are deliberately different
// sizes) and its OWN placement strategy (prefer-top vs flip-left-right
// vs anchor-below). Those are per-component design choices, not shared
// state — only the edge inset and the clamp arithmetic are common.

// The px gap floating UI keeps from the viewport edge so a box anchored
// on a near-edge trigger never bleeds off-screen.
export const POPOVER_VIEWPORT_MARGIN = 8;

// Clamp a single coordinate into `[min, max]`. The arithmetic every
// portal positioner repeated as `Math.max(min, Math.min(max, value))`
// to keep a left/top edge (or an anchored centre) inside the viewport.
// When `max < min` (the box is wider/taller than the available space)
// the lower bound wins, matching the previous inlined behaviour.
export function clampIntoRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// A box's edges on screen, in client pixels: a DOMRect, or any box measured like one.
export type ScreenEdges = { left: number; top: number; right: number; bottom: number };

// How far to move an overlay, in screen pixels, to keep it on screen.
export type OnScreenShift = { x: number; y: number };

// The shift along one axis that keeps [start, end] inside [margin, size - margin]. A box longer than that room keeps
// its start edge in (its left, or its top), where it is read from, rather than sliding past it to show its end.
export function shiftIntoRange(
  start: number,
  end: number,
  size: number,
  margin: number = POPOVER_VIEWPORT_MARGIN,
): number {
  if (start < margin || end - start > size - 2 * margin) return margin - start;
  if (end > size - margin) return size - margin - end;
  return 0;
}

// The widest an anchored overlay may be: the screen less its margin on each side. As CSS (a `max-width`, so the
// overlay never needs measuring to fit), and as a number for a screen `width` wide.
export const OVERLAY_MAX_WIDTH = `calc(100vw - ${2 * POPOVER_VIEWPORT_MARGIN}px)`;
export function overlayMaxWidth(width: number, margin: number = POPOVER_VIEWPORT_MARGIN): number {
  return Math.max(0, width - 2 * margin);
}

// The shift that keeps an anchored overlay (`box`, where it sits now) inside a `viewport` less `margin`. Across, it
// slides in from whichever edge it crosses: a hover line or popover hung from an element's left edge near the right
// of a phone moves left as far as it overflows, never past the left edge. Down, given the `anchor` it hangs from, an
// overlay below the anchor that runs off the bottom flips above it (one above that runs off the top flips below), the
// same gap away, when it fits there; otherwise it slides in as across.
export function keepOnScreen(
  box: ScreenEdges,
  viewport: { width: number; height: number },
  {
    anchor,
    margin = POPOVER_VIEWPORT_MARGIN,
  }: { anchor?: { top: number; bottom: number }; margin?: number } = {},
): OnScreenShift {
  const x = shiftIntoRange(box.left, box.right, viewport.width, margin);
  const height = box.bottom - box.top;
  if (anchor && box.top >= anchor.bottom && box.bottom > viewport.height - margin) {
    const top = anchor.top - (box.top - anchor.bottom) - height;
    if (top >= margin) return { x, y: top - box.top };
  } else if (anchor && box.bottom <= anchor.top && box.top < margin) {
    const top = anchor.bottom + (anchor.top - box.bottom);
    if (top + height <= viewport.height - margin) return { x, y: top - box.top };
  }
  return { x, y: shiftIntoRange(box.top, box.bottom, viewport.height, margin) };
}
