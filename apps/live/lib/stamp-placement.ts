import {
  ES_LANES,
  eventStormingNoteSize,
  isEventStormingTab,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import type { LanePreview } from '@/lib/lane-preview';
import { paletteDragSnapAt } from '@/lib/palette-drag-snap';

// Placing a fixed-size note from an armed palette tile (docs/specs/021-event-storming/event-storming.md Phase 4). A
// workshop note has one size for life, so the gesture that would draw a box
// to size instead STAMPS the note: a ghost of it follows the pointer, and it
// lands centred where the pointer is released. On an event-storming board it
// meets the lanes the way a dragged note does. The ghost, the lane overlay and
// the drop all read this one answer, so the preview cannot lie about the drop.

type Size = { width: number; height: number };
type BoardLike = Pick<Tab, 'elements'> & Partial<Pick<Tab, 'kind' | 'layers'>>;

// The note's size when this intent is a stamp, or null when it draws to size.
// A kinded note takes its own silhouette on any board; a plain sticky is fixed
// only on an event-storming board.
export function stampSizeFor(intent: PendingDraw, board: BoardLike): Size | null {
  if (intent.type !== 'sticky') return null;
  if (intent.esKind) return eventStormingNoteSize(intent.esKind);
  return isEventStormingTab(board) ? { width: 200, height: 200 } : null;
}

export type StampPlacement = {
  // Where the note lands, in canvas coords.
  bounds: { x: number; y: number; width: number; height: number };
  // The lane it claims, for the overlay; null off an event-storming board or
  // between lanes.
  lane: LanePreview | null;
};

export function stampPlacement(
  canvasX: number,
  canvasY: number,
  size: Size,
  board: BoardLike,
): StampPlacement {
  const snap = paletteDragSnapAt({
    canvasX,
    canvasY,
    ...size,
    elements: board.elements as Element[],
    timeline: isEventStormingTab(board) ? ES_LANES : null,
  });
  const cx = canvasX + snap.dx;
  const cy = canvasY + snap.dy;
  return {
    bounds: { x: cx - size.width / 2, y: cy - size.height / 2, ...size },
    lane: snap.lane,
  };
}
