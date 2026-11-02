// Which canvas gesture a drag is (docs/specs/008-canvas/canvas-performance.md), and whether it waits
// for the pointer to travel DRAG_ENGAGE_PX before it counts as one.
import type { CanvasGesture } from '@/lib/canvas-gesture';
import type { DragState } from '@/lib/canvas';

export function gestureOfDrag(drag: DragState): CanvasGesture {
  switch (drag.kind) {
    case 'boxed':
      return drag.mode === 'move' ? 'move' : 'resize';
    case 'arrow-translate':
      return 'move';
    case 'arrow-scale':
      return 'resize';
    default:
      return 'reshape';
  }
}

// A body move and an arrow handle are clicks until they travel; a resize and a new arrow's end
// following the pointer act at once (the same split as useEditorDrag's engage threshold).
export function dragWaitsToEngage(drag: DragState): boolean {
  if (drag.kind === 'boxed') return drag.mode === 'move';
  if (drag.kind === 'arrow-endpoint') return drag.reposition === true;
  return true;
}
