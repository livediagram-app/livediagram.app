// Which canvas gesture a drag is (docs/specs/008-canvas/canvas-performance.md), and whether it waits
// for the pointer to travel DRAG_ENGAGE_PX before it counts as one.
import type { CanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import type { DragState } from '@/lib/canvas';

export function gestureOfDrag(drag: DragState): CanvasGesture {
  return drag.mode === 'move' ? 'move' : 'resize';
}

// A body move is a click until it travels; a resize acts at once (the same split as useEditorDrag's
// engage threshold).
export function dragWaitsToEngage(drag: DragState): boolean {
  return drag.mode === 'move';
}
