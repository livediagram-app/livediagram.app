import type { IconPosition } from '@liveworkspace/model-core/basics';

// The canvas constants and small types every editor's lib/canvas.ts held word for word. Each lib/canvas.ts
// re-exports the ones it uses, so the shared canvas modules and the editors read one set.

// Which side of a boxed element a screen point sits nearest, normalised by
// half-extent so a wide-but-short box still reads top / bottom correctly.
// Shared by the icon-drop hover preview (BoxedElementView) and the drop-commit
// (useEditorDrag) so both pick the same side.
export function iconDropSide(clientX: number, clientY: number, rect: DOMRect): IconPosition {
  const dx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2 || 1);
  const dy = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2 || 1);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'above' : 'below';
}

// Which end of an arrow a gesture holds.
export type ArrowEnd = 'from' | 'to';

// Quick add + connect: which action the radial ring fired. 'duplicate' clones the source; 'text' drops a
// label to the side.
export type QuickConnectKind = 'duplicate' | 'text';

export const SNAP_THRESHOLD = 24;
// Pixel range within which a dragged element's edges/centres snap to
// align with another element's edges/centres. Tight enough that nudging
// off the line takes deliberate motion.
export const ALIGN_SNAP_THRESHOLD = 6;
// Arrow-to-arrow snapping. REVEAL is the perpendicular distance at which a nearby arrow's snap dots appear
// while dragging an endpoint; THRESHOLD (tighter) is where the endpoint actually connects, also used when
// committing a freshly-drawn arrow so it can land on a line without a follow-up nudge. Both a touch more
// generous than the element-anchor snap so a thin line is catchable.
export const ARROW_SNAP_REVEAL_PX = 36;
export const ARROW_SNAP_THRESHOLD_PX = 12;

// A connection-point marker shown while dragging an arrow endpoint: the
// world-space position of a nearby shape's anchor, with `active` set on the
// one the endpoint is currently snapped to. Rendered by CanvasChrome.
export type SnapTarget = { x: number; y: number; active: boolean };
