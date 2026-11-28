import {
  isBoxed,
  isFixedSizeShape,
  isRetiredBackdrop,
  type BoxedElement,
  type Element,
  isSelfDrawingShape,
} from '@livehuddle/document';
import { floorPointer } from '@/lib/space-3d/floor-pointer';

// The snap thresholds, the arrow end and the icon drop side every editor shares
// (@liveworkspace/workbench/lib/canvas-snap.ts), re-exported so importers keep resolving.
export {
  iconDropSide,
  SNAP_THRESHOLD,
  ALIGN_SNAP_THRESHOLD,
} from '@liveworkspace/workbench/lib/canvas-snap';

// Convert a pointer's screen coords into canvas coords: shift by the canvas
// element's top-left, then divide by zoom (the canvas transform is
// `scale(zoom) translate(offset)`, so this inverts the scale). The result is
// pre-pan; callers that need fully world-space coords subtract the pan offset
// themselves. Centralises the transform that was inlined at every pointer
// handler in Canvas.tsx.
//
// In the tilted 3D view the point is where the pointer meets the floor (3d-view.md "Editing in 3D").
export function pointerToCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  zoom: number,
): { x: number; y: number } {
  const floor = floorPointer(clientX, clientY);
  if (floor) return floor;
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
}

/**
 * How far the pointer has moved, in canvas px, from a press at (startX, startY): the screen move over the zoom, or in
 * the tilted 3D view the move between the floor points under each (3d-view.md "Editing in 3D").
 */
export function pointerDelta(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  zoom: number,
): { dx: number; dy: number } {
  const a = floorPointer(startX, startY);
  const b = floorPointer(clientX, clientY);
  if (a && b) return { dx: b.x - a.x, dy: b.y - a.y };
  return { dx: (clientX - startX) / zoom, dy: (clientY - startY) / zoom };
}

// Size a newly-added boxed element. It inherits the currently-selected
// boxed element's width / height (so adding elements one after another
// keeps a consistent size), falling back to the factory default when
// nothing boxed is selected. Shared by the palette
// tap-to-drop (addBoxed) and the combined add gesture's tap branch
// (useShapeDrawing.commitDraw) so both paths size new elements the same.
export function inheritedSizeFor(
  base: BoxedElement,
  selected: Element | null | undefined,
): { width: number; height: number } {
  // The kinds whose silhouette IS the element: a portal's ring
  // (docs/specs/009-elements/portal-element.md) and the fixed-size Selection Mode button (docs/specs/009-elements/mode-button.md). Inheriting
  // whatever box happened to be selected — a wide banner, a thin rail — hands
  // you something that doesn't read as the thing you asked for, and for a
  // fixed-size control it is simply not resizable afterwards.
  if (base.type === 'shape' && (base.shape === 'portal' || isFixedSizeShape(base.shape))) {
    return { width: base.width, height: base.height };
  }
  // And the kinds drawn to their own proportions: a chart, a meter, a rating, a legend, a sticker each draws its own
  // content to its own proportions. A progress bar tapped while a legend was selected came out a 200 x 170 blob.
  if (base.type === 'shape' && isSelfDrawingShape(base.shape)) {
    return { width: base.width, height: base.height };
  }
  // A BACKDROP never donates its size. A stored frame, lane, stack or boundary is a big retired backdrop
  // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"), so a square added while one is
  // selected came out 900x200, the size of the lane, which is never what anyone meant. The
  // rule reads the other way round from the guards above: those are about what
  // the NEW element is, this is about what the selected one is.
  // The same holds for a self-drawing donor: a square added while a rating or a progress bar was selected came out as
  // thin as the bar.
  const donor = selected && isBoxed(selected) ? selected : null;
  const keepsOwnSize =
    !!donor &&
    (isRetiredBackdrop(donor) || (donor.type === 'shape' && isSelfDrawingShape(donor.shape)));
  const inherit = keepsOwnSize ? null : donor;
  return { width: inherit?.width ?? base.width, height: inherit?.height ?? base.height };
}

// Stable reorder that puts stored backdrops (a retired frame, lane, stack or boundary,
// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine") FIRST (lowest paint / z-order): what sat
// on one must stay visible and clickable over its placeholder. Both the on-canvas render layer and the exporters
// route element lists through this, so the order is one rule in one place and never depends on array position.
// Returns the input array unchanged when there are no backdrops (cheap no-op).
export function framesFirst<T extends Element>(elements: T[]): T[] {
  if (!elements.some(isRetiredBackdrop)) return elements;
  return [
    ...elements.filter(isRetiredBackdrop),
    ...elements.filter((el) => !isRetiredBackdrop(el)),
  ];
}

// Resize geometry (nextBounds / union scaling / corner lookups), DragMode +
// MIN_SIZE / ShapeBounds live in resize-geometry.ts; re-exported so
// importers keep resolving.
import type { DragMode, ShapeBounds } from '@liveworkspace/workbench/lib/resize-geometry';

export {
  constrainedBounds,
  cornerOf,
  leadingAxis,
  MIN_SIZE,
  minUniformScale,
  nextBounds,
  snapLeadingAxis,
  snapModeOf,
  unionResizeMember,
  type DragMode,
  type ShapeBounds,
} from '@liveworkspace/workbench/lib/resize-geometry';

// Viewport zoom bounds, shared by the +/- buttons and the pinch / wheel zoom
// (@liveworkspace/workbench/lib/zoom-range.ts).
export { ZOOM_MAX, ZOOM_MIN } from '@liveworkspace/workbench/lib/zoom-range';

// The in-flight drag the canvas can be holding: a boxed move or resize. (The arrow
// gestures left with the element engine's part 4, docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine".) It carries the start-of-gesture state the
// pointer-move handler needs to project the current cursor delta into
// canvas coordinates.
export type DragState = {
  kind: 'boxed';
  primaryId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  // Every selected element's start bounds (keyed by id) so a
  // multi-select move/resize can update each one without losing
  // its original position.
  startBounds: Map<string, ShapeBounds>;
  // The full element array as it stood at grab time (a reference to the
  // then-current immutable array, so this is cheap). The shift-duplicate
  // identity swap (docs/specs/008-canvas/shift-drag-duplicate.md) restores the dragged elements from
  // here when it parks the originals.
  startElements: Element[];
  aspectLocked: boolean;
};
