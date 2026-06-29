// spec/09: where an element's context menu anchors. The menu opens BESIDE the
// element at its top-right corner (so it never covers what you're editing),
// flipping to the top-left when the fixed-width menu wouldn't fit to the right,
// and held a few px off the edge so it clears the element's border. Shared by
// the right-click / long-press handler (BoxedElementView) and the toolbar
// "More" button (via Canvas) so every entry point opens the menu identically.

// ContextMenu renders at a fixed w-56 (14rem = 224px); used to decide whether
// the menu fits to the right of the element before it would clip off-screen.
export const CONTEXT_MENU_WIDTH = 224;

// Breathing room between the element edge and the menu, so a thick border /
// selection ring isn't tucked under the menu's edge.
const GAP = 8;

// Given an element's on-screen rect (DOMRect-like), return the screen-space
// (x, y) the context menu's top-left should sit at: the element's top-right
// corner + a gap, or its top-left minus the menu width + gap when there isn't
// room on the right. Vertical clamping is left to ContextMenu itself.
export function elementMenuAnchor(rect: { left: number; right: number; top: number }): {
  x: number;
  y: number;
} {
  const fitsRight =
    typeof window !== 'undefined' && window.innerWidth - rect.right >= CONTEXT_MENU_WIDTH + GAP;
  const x = fitsRight ? rect.right + GAP : rect.left - CONTEXT_MENU_WIDTH - GAP;
  return { x, y: rect.top };
}
