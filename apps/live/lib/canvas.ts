import {
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ShapeElement,
} from '@livediagram/diagram';

// Size a newly-added boxed element. It inherits the currently-selected
// boxed element's width / height (so adding elements one after another
// keeps a consistent size), falling back to the factory default when
// nothing boxed is selected. Circles + diamonds are forced square — a
// non-square inherited size would squash them. Shared by the palette
// tap-to-drop (addBoxed) and the combined add gesture's tap branch
// (useShapeDrawing.commitDraw) so both paths size new elements the same.
export function inheritedSizeFor(
  base: BoxedElement,
  selected: Element | null | undefined,
): { width: number; height: number } {
  // Annotations are a fixed marker size (spec/38): never inherit the
  // selection's dimensions, so a marker added while a big shape is selected
  // doesn't balloon. It stays its intrinsic 44×44.
  if (base.type === 'annotation') return { width: base.width, height: base.height };
  const inherit = selected && isBoxed(selected) ? selected : null;
  let width = inherit?.width ?? base.width;
  let height = inherit?.height ?? base.height;
  if (base.type === 'shape' && (base.shape === 'circle' || base.shape === 'diamond')) {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }
  return { width, height };
}

// Frame "section" membership (spec/09): the ids in `ids` plus every boxed
// element whose CENTRE lies inside any frame in `ids`. Used to expand a
// frame's move set so dragging the frame carries everything sitting inside
// it (pinned arrows between members follow via the post-move rebind). A
// no-op (returns `ids` unchanged) when none of the ids are frames, so a
// normal drag pays nothing. Centre-point containment (not full-bounds) so a
// shape straddling the frame edge still counts as "in" when most of it is.
export function withFrameContents(elements: Element[], ids: Set<string>): Set<string> {
  const frames = elements.filter(
    (el): el is ShapeElement => ids.has(el.id) && el.type === 'shape' && el.shape === 'frame',
  );
  if (frames.length === 0) return ids;
  const expanded = new Set(ids);
  for (const f of frames) {
    for (const el of elements) {
      if (expanded.has(el.id) || !isBoxed(el)) continue;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      if (cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height) {
        expanded.add(el.id);
      }
    }
  }
  return expanded;
}

// Stable reorder that puts frames FIRST (lowest paint / z-order): a frame
// is a section backdrop that must sit behind its contents so they stay
// visible + clickable (spec/09). Both the on-canvas render layer and the
// exporters route element lists through this, so frame ordering is one
// rule in one place and never depends on array position. Returns the input
// array unchanged when there are no frames (cheap no-op).
export function framesFirst<T extends Element>(elements: T[]): T[] {
  const isFrameEl = (el: Element) => el.type === 'shape' && el.shape === 'frame';
  if (!elements.some(isFrameEl)) return elements;
  return [...elements.filter(isFrameEl), ...elements.filter((el) => !isFrameEl(el))];
}

// One of the gestures a `BoxedElementView` can be in mid-drag. `move`
// is the body drag; the four `resize-*` corners are the bounding-box
// handles.
export type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

export type ArrowEnd = 'from' | 'to';

// Quick add + connect (spec/09): the side of a selected element a
// quick-action targets, and which action the radial ring fired. 'duplicate'
// clones the source; the shape kinds spawn a fresh element matching it.
export type QuickConnectDirection = 'right' | 'below' | 'left' | 'above';
export type QuickConnectKind = 'duplicate' | 'square' | 'circle';

export const SNAP_THRESHOLD = 24;
// Pixel range within which a dragged element's edges/centres snap to
// align with another element's edges/centres. Tight enough that nudging
// off the line takes deliberate motion.
export const ALIGN_SNAP_THRESHOLD = 6;

// Floor for any single side of a boxed element during a resize. Below
// this the shape becomes a pinprick that's near-impossible to grab
// again, so the resize math clamps both axes here.
export const MIN_SIZE = 20;

// Viewport zoom bounds, shared by the +/- buttons and the pinch / wheel
// zoom so the two can never drift apart. 0.1 = 10%, 5 = 500%.
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;

// Rotation snap: dragging the rotate handle snaps to the nearest
// 15-degree increment (which covers 0 / 45 / 90 / 180 / ...) whenever
// the raw angle lands within ROTATION_SNAP_DEG of one, so squaring a
// shape up is effortless. Holding Shift (passed as `free`) disables
// the snap for fine control.
const ROTATION_SNAP_STEP = 15;
const ROTATION_SNAP_DEG = 7;

// Normalise a rotation in degrees into [0, 360) and, unless `free`,
// snap it to the nearest ROTATION_SNAP_STEP when within
// ROTATION_SNAP_DEG of it. Pure + framework-free so it's unit-testable.
export function snapRotation(deg: number, free: boolean): number {
  let r = deg % 360;
  if (r < 0) r += 360;
  if (free) return r;
  const nearest = Math.round(r / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP;
  if (Math.abs(r - nearest) <= ROTATION_SNAP_DEG) return nearest % 360;
  return r;
}

// The axis-aligned bounding rectangle a boxed element occupies on the
// canvas. The drag pipeline reads start-bounds at gesture begin and
// recomputes a fresh ShapeBounds on every pointer move.
export type ShapeBounds = { x: number; y: number; width: number; height: number };

// Discriminated union covering every in-flight drag the canvas can be
// holding. Each variant carries the start-of-gesture state the
// pointer-move handler needs to project the current cursor delta into
// canvas coordinates.
export type DragState =
  | {
      kind: 'boxed';
      primaryId: string;
      mode: DragMode;
      startClientX: number;
      startClientY: number;
      // Every selected element's start bounds (keyed by id) so a
      // multi-select move/resize can update each one without losing
      // its original position.
      startBounds: Map<string, ShapeBounds>;
      aspectLocked: boolean;
    }
  | {
      kind: 'arrow-endpoint';
      arrowId: string;
      end: ArrowEnd;
      startClientX: number;
      startClientY: number;
      startCanvasX: number;
      startCanvasY: number;
    }
  | {
      // Whole-arrow translation. Only fires for arrows with both
      // endpoints `kind: 'free'` (pinned endpoints stay anchored to
      // their elements, so there's nothing to drag).
      kind: 'arrow-translate';
      arrowId: string;
      startClientX: number;
      startClientY: number;
      startFromX: number;
      startFromY: number;
      startToX: number;
      startToY: number;
    }
  | {
      // Curve-handle drag: the user grabbed the small handle that
      // sits on a curved arrow's quadratic Bezier control point and
      // is moving it. We capture the chord midpoint + the existing
      // offset at gesture start so the on-move handler can compute
      // a fresh offset from the current pointer position regardless
      // of where the user originally grabbed.
      kind: 'arrow-curve';
      arrowId: string;
      startClientX: number;
      startClientY: number;
      // Chord midpoint at the start of the drag, in canvas coords.
      // Captured here rather than recomputed on every move so the
      // gesture survives the endpoints moving mid-drag (eg. another
      // user nudges a connected element).
      startMidX: number;
      startMidY: number;
      // Pointer-to-control offset captured at the moment the user
      // grabbed the handle. Lets the move handler compute the new
      // control point as `pointer + (control - pointer at start)`,
      // so the handle stays exactly under the cursor.
      grabDx: number;
      grabDy: number;
    }
  | {
      // Elbow-handle drag: same shape as arrow-curve but for angled
      // arrows. The user grabbed the elbow point and is dragging it
      // to bend the arrow's right-angle break somewhere else. We
      // capture the auto-elbow position (the corner the arrow would
      // draw without offset) + the pointer-to-elbow grab offset so
      // the elbow tracks the cursor with a stable grab handle.
      kind: 'arrow-elbow';
      arrowId: string;
      startClientX: number;
      startClientY: number;
      // Auto-computed elbow corner at the start of the gesture, in
      // canvas coords. The new elbowOffset is computed as
      // `(currentElbow - startBaseElbow)` so the gesture survives
      // endpoint moves the same way arrow-curve does.
      startBaseX: number;
      startBaseY: number;
      grabDx: number;
      grabDy: number;
    }
  | {
      // Label drag: the user grabbed an arrow's text label and is
      // sliding it along the line / to either side. We capture the
      // pointer start in client coords + the label's anchor point at
      // grab time so the move handler reconstructs the dragged point
      // (anchor + pointer delta) and projects it back onto the line.
      kind: 'arrow-label';
      arrowId: string;
      startClientX: number;
      startClientY: number;
      // The label's anchor point (canvas coords) when the drag began,
      // so the new placement tracks `anchor + delta` projected onto
      // the line — the label stays under the cursor.
      startAnchorX: number;
      startAnchorY: number;
    }
  | {
      // Rotate-handle drag: the user grabbed the rotate handle and is
      // spinning the element about its centre. Captured in CLIENT
      // (screen) coordinates — rotation is conformal under the uniform
      // canvas zoom, so the angle the pointer sweeps in screen space
      // equals the angle in canvas space, and no zoom/pan inversion is
      // needed.
      kind: 'rotate';
      elementId: string;
      // Element centre in client coords at gesture start. Because
      // rotation is about the centre, the element's bounding-rect
      // centre stays put as it spins, so this stays valid all drag.
      centerClientX: number;
      centerClientY: number;
      // Pointer angle (radians) from the centre at gesture start, plus
      // the element's rotation then: newRotation = startRotation +
      // (currentAngle - startPointerAngle).
      startPointerAngle: number;
      startRotation: number;
    };

// Given a shape's bounds at gesture start, project the current pointer
// delta (`dx`, `dy` already in canvas coordinates — caller has
// inverted the zoom) into a fresh ShapeBounds for the given drag mode.
//
// `move` translates the shape uniformly. Each `resize-*` mode pulls
// the matching corner; `aspectLocked` collapses the two-axis input
// onto a single dominant axis (the one whose delta is larger) so the
// width:height ratio survives the gesture. Both branches floor each
// side at `MIN_SIZE` so a shape can't be dragged down to a pinprick.
export function nextBounds(
  start: ShapeBounds,
  mode: DragMode,
  dx: number,
  dy: number,
  aspectLocked: boolean,
): ShapeBounds {
  const { x, y, width, height } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, width, height };

  const freeForCorner = (signX: number, signY: number) => {
    const newW = Math.max(MIN_SIZE, width + signX * dx);
    const newH = Math.max(MIN_SIZE, height + signY * dy);
    return { newW, newH };
  };

  const lockedForCorner = (signX: number, signY: number) => {
    const candW = Math.max(MIN_SIZE, width + signX * dx);
    const candH = Math.max(MIN_SIZE, height + signY * dy);
    const ratio = width / height;
    const useW = Math.abs(candW - width) >= Math.abs(candH - height);
    const newW = useW ? candW : candH * ratio;
    const newH = useW ? candW / ratio : candH;
    return { newW: Math.max(MIN_SIZE, newW), newH: Math.max(MIN_SIZE, newH) };
  };

  const compute = aspectLocked ? lockedForCorner : freeForCorner;

  switch (mode) {
    case 'resize-se': {
      const { newW, newH } = compute(1, 1);
      return { x, y, width: newW, height: newH };
    }
    case 'resize-sw': {
      const { newW, newH } = compute(-1, 1);
      return { x: x + (width - newW), y, width: newW, height: newH };
    }
    case 'resize-ne': {
      const { newW, newH } = compute(1, -1);
      return { x, y: y + (height - newH), width: newW, height: newH };
    }
    case 'resize-nw': {
      const { newW, newH } = compute(-1, -1);
      return { x: x + (width - newW), y: y + (height - newH), width: newW, height: newH };
    }
  }
}

// Group-resize math: given the union bounding box at drag start,
// the same union after `nextBounds` runs against the drag, and the
// corner the user is pulling, scale a single member's start bounds
// proportionally around the corner opposite the drag handle (the
// fixed anchor). Width / height are floored at MIN_SIZE so tiny
// members inside a large union don't collapse when sx / sy round
// down hard. Pure function (no React, no element types), so it
// stays trivially testable.
export function unionResizeMember(
  member: ShapeBounds,
  unionStart: ShapeBounds,
  unionNext: ShapeBounds,
  corner: 'nw' | 'ne' | 'sw' | 'se',
): ShapeBounds {
  const sx = unionNext.width / Math.max(unionStart.width, 1);
  const sy = unionNext.height / Math.max(unionStart.height, 1);
  // Anchor = union corner OPPOSITE the drag handle; that point
  // stays fixed in canvas-space throughout the resize. nextBounds
  // already keeps it implicit on the union itself; here we mirror
  // the arithmetic so members get repositioned around the same
  // anchor.
  const anchorX =
    corner === 'sw' || corner === 'nw' ? unionStart.x + unionStart.width : unionStart.x;
  const anchorY =
    corner === 'ne' || corner === 'nw' ? unionStart.y + unionStart.height : unionStart.y;
  return {
    x: anchorX + (member.x - anchorX) * sx,
    y: anchorY + (member.y - anchorY) * sy,
    width: Math.max(MIN_SIZE, member.width * sx),
    height: Math.max(MIN_SIZE, member.height * sy),
  };
}

// Union bounding box of a Map of starts (the shape `drag.startBounds`
// carries during a boxed-element drag). Returns null when the map is
// empty so callers can short-circuit. Pulled out so the resize and
// the test suite share one definition.
export function unionOfBounds(boundsList: Iterable<ShapeBounds>): ShapeBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let saw = false;
  for (const b of boundsList) {
    saw = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!saw) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Map a DragMode to the corner letter, or null if the mode isn't a
// resize. The same lookup happens in two places (the resize effect +
// snap helpers); keeping it here avoids the parallel-table drift.
export function cornerOf(mode: DragMode): 'nw' | 'ne' | 'sw' | 'se' | null {
  switch (mode) {
    case 'resize-nw':
      return 'nw';
    case 'resize-ne':
      return 'ne';
    case 'resize-sw':
      return 'sw';
    case 'resize-se':
      return 'se';
    case 'move':
      return null;
  }
}

// True when either of the arrow's endpoints is pinned to one of the
// given element ids. Used by the deletion / cascading-update paths so
// arrows attached to a removed box can be cleaned up alongside it.
export function arrowReferencesAny(arrow: ArrowElement, ids: Set<string>): boolean {
  return (
    (arrow.from.kind === 'pinned' && ids.has(arrow.from.elementId)) ||
    (arrow.to.kind === 'pinned' && ids.has(arrow.to.elementId))
  );
}
