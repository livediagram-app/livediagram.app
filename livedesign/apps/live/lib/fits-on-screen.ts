// Whether an element fits on the screen, for the touch drag rule (docs/specs/008-canvas/canvas-and-palette.md
// "Touch (iOS / iPad)"): a finger moves an element only when all of it is in view, and pans across one that runs off the
// screen. Rects are on-screen (getBoundingClientRect), so zoom, pan and rotation are already applied.

type Rect = { left: number; top: number; right: number; bottom: number };

// Sub-pixel slack, so an element fitted edge to edge (zoom-to-fit rounds to whole pixels) still counts as in view.
export const FIT_SLACK_PX = 1;

export function rectFitsWithin(inner: Rect, outer: Rect): boolean {
  return (
    inner.left >= outer.left - FIT_SLACK_PX &&
    inner.top >= outer.top - FIT_SLACK_PX &&
    inner.right <= outer.right + FIT_SLACK_PX &&
    inner.bottom <= outer.bottom + FIT_SLACK_PX
  );
}

// The element's node against the canvas surface it sits on (`data-canvas-root`). True when either cannot be
// measured, so a missing surface never stops a drag.
export function fitsOnCanvas(node: Element | null): boolean {
  const surface = node?.closest('[data-canvas-root]');
  if (!node || !surface) return true;
  return rectFitsWithin(node.getBoundingClientRect(), surface.getBoundingClientRect());
}
