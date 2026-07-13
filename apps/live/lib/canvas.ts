import {
  isBoxed,
  type BoxedElement,
  type Element,
  type IconPosition,
  type ShapeElement,
} from '@livediagram/diagram';

// Which side of a boxed element a screen point sits nearest, normalised by
// half-extent so a wide-but-short box still reads top / bottom correctly.
// Shared by the icon-drop hover preview (BoxedElementView) and the drop-commit
// (useEditorDrag) so both pick the same side.
export function iconDropSide(clientX: number, clientY: number, rect: DOMRect): IconPosition {
  const dx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2 || 1);
  const dy = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2 || 1);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'above' : 'below';
}

// Convert a pointer's screen coords into canvas coords: shift by the canvas
// element's top-left, then divide by zoom (the canvas transform is
// `scale(zoom) translate(offset)`, so this inverts the scale). The result is
// pre-pan; callers that need fully world-space coords subtract the pan offset
// themselves. Centralises the transform that was inlined at every pointer
// handler in Canvas.tsx.
export function pointerToCanvas(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  zoom: number,
): { x: number; y: number } {
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
}

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

// Frame "section" membership (spec/09): the ids in `ids` plus every element
// OWNED by a frame in `ids`. Used to expand a frame's move set so dragging the
// frame carries everything sitting inside it. Pinned arrows between two members
// follow via the post-move rebind regardless; this also catches a FREE-floating
// arrow (or the free end of a half-pinned one) drawn inside the frame, so it
// translates with the section instead of being left behind. A no-op (returns
// `ids` unchanged) when none of the ids are frames, so a normal drag pays
// nothing. FULL-BOUNDS containment: a boxed element travels only when its
// whole box sits inside the frame. A shape straddling or just touching the
// frame edge stays put (it used to be centre-point containment, which
// dragged half-out elements along and read as the frame "grabbing"
// neighbours it merely touched). Arrow free endpoints are points, so
// point containment is exact for them.
//
// Two rules make overlapping / touching frames behave:
//   1. Frames are NEVER carried as another frame's contents — moving one frame
//      must not drag a frame it touches or overlaps. (Nest visually all you
//      like; each frame still moves independently.)
//   2. An element inside MORE THAN ONE frame belongs to exactly one: the frame
//      closest to the BACK of the canvas (lowest z-order = earliest in the
//      `elements` array). So it travels only when that backmost owner is the
//      one being dragged, not when some other overlapping frame is.
// A frame shape (the section-container kind, spec/09). The check recurs across
// the frame-section + frames-first logic below; one definition keeps it in step.
const isFrameEl = (el: Element): boolean => el.type === 'shape' && el.shape === 'frame';

export function withFrameContents(elements: Element[], ids: Set<string>): Set<string> {
  const draggedFrameIds = new Set(
    elements.filter((el) => ids.has(el.id) && isFrameEl(el)).map((el) => el.id),
  );
  if (draggedFrameIds.size === 0) return ids;
  // Every frame, in array order (lower index = further back). Ownership of an
  // overlapped element resolves against ALL frames, not just the dragged ones.
  const allFrames = elements.filter((el): el is ShapeElement => isFrameEl(el));
  const contains = (f: ShapeElement, x: number, y: number) =>
    x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height;
  // The whole rect inside the frame (boundary-flush counts as inside).
  const containsRect = (
    f: ShapeElement,
    r: { x: number; y: number; width: number; height: number },
  ) =>
    r.x >= f.x && r.y >= f.y && r.x + r.width <= f.x + f.width && r.y + r.height <= f.y + f.height;
  // The backmost frame (first in array order) whose bounds contain (x, y).
  const owningFrame = (x: number, y: number): ShapeElement | null =>
    allFrames.find((f) => contains(f, x, y)) ?? null;
  // Boxed-element ownership: the backmost frame FULLY containing the box.
  const rectOwnedByDragged = (r: { x: number; y: number; width: number; height: number }) => {
    const owner = allFrames.find((f) => containsRect(f, r)) ?? null;
    return owner !== null && draggedFrameIds.has(owner.id);
  };
  const expanded = new Set(ids);
  for (const el of elements) {
    if (expanded.has(el.id)) continue;
    // Rule 1: a frame never travels as another frame's content.
    if (isFrameEl(el)) continue;
    if (isBoxed(el)) {
      if (rectOwnedByDragged(el)) expanded.add(el.id);
    } else if (el.type === 'arrow') {
      // Only the arrow's FREE endpoints have fixed coordinates; pinned ends
      // follow their element. Move the arrow with the frame when it has a free
      // end and every free end is owned by the SAME dragged frame (a free end
      // outside, or owned by a different/backmost frame, means leave it put).
      const freePts: Array<{ x: number; y: number }> = [];
      if (el.from.kind === 'free') freePts.push({ x: el.from.x, y: el.from.y });
      if (el.to.kind === 'free') freePts.push({ x: el.to.x, y: el.to.y });
      if (freePts.length === 0) continue;
      const owners = freePts.map((p) => owningFrame(p.x, p.y));
      const first = owners[0];
      if (first && draggedFrameIds.has(first.id) && owners.every((o) => o?.id === first.id)) {
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
  if (!elements.some(isFrameEl)) return elements;
  return [...elements.filter(isFrameEl), ...elements.filter((el) => !isFrameEl(el))];
}

// One of the gestures a `BoxedElementView` can be in mid-drag. `move`
// is the body drag; the four `resize-*` corners are the bounding-box
// handles.
export type DragMode =
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  // Edge handles: single-axis resize. n/s change height only, e/w width only.
  | 'resize-n'
  | 'resize-s'
  | 'resize-e'
  | 'resize-w';

// Resize geometry (nextBounds / union scaling / corner lookups) +
// MIN_SIZE / ShapeBounds live in resize-geometry.ts; re-exported so
// importers keep resolving.
import type { ShapeBounds } from './resize-geometry';

export {
  cornerOf,
  MIN_SIZE,
  nextBounds,
  snapModeOf,
  unionOfBounds,
  unionResizeMember,
  type ResizeSnapMode,
  type ShapeBounds,
} from './resize-geometry';

export type ArrowEnd = 'from' | 'to';

// Quick add + connect (spec/09): the side of a selected element a
// quick-action targets, and which action the radial ring fired. 'duplicate'
// clones the source; 'text' drops a label to the side.
export type QuickConnectDirection = 'right' | 'below' | 'left' | 'above';
export type QuickConnectKind = 'duplicate' | 'text';

export const SNAP_THRESHOLD = 24;
// Pixel range within which a dragged element's edges/centres snap to
// align with another element's edges/centres. Tight enough that nudging
// off the line takes deliberate motion.
export const ALIGN_SNAP_THRESHOLD = 6;
// Arrow-to-arrow snapping (spec/50). REVEAL is the perpendicular distance at
// which a nearby arrow's snap dots appear while dragging an endpoint; THRESHOLD
// (tighter) is where the endpoint actually connects — also used when committing
// a freshly-drawn arrow so it can land on a line without a follow-up nudge. Both
// a touch more generous than the element-anchor snap so a thin line is catchable.
export const ARROW_SNAP_REVEAL_PX = 36;
export const ARROW_SNAP_THRESHOLD_PX = 12;

// Viewport zoom bounds, shared by the +/- buttons and the pinch / wheel
// zoom so the two can never drift apart. 0.1 = 10%, 5 = 500%.
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;

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
      // Free arrow endpoints (keyed by arrow id) captured at grab time, for
      // arrows pulled into a frame-section move: their free ends translate
      // with the section (pinned ends rebind). Empty for a normal drag.
      startArrowEnds: Map<
        string,
        { from?: { x: number; y: number }; to?: { x: number; y: number } }
      >;
      // The full element array as it stood at grab time (a reference to the
      // then-current immutable array, so this is cheap). The shift-duplicate
      // identity swap (spec/80) restores the dragged elements AND every arrow
      // connected to them from here when it parks the originals — a plain
      // position park would keep the anchor faces the auto-rebind pass
      // re-picked while the originals were still the ones moving, visibly
      // shifting arrows on shapes that never moved.
      startElements: Element[];
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
      // Quick-connect "click to place": the gesture started from a click
      // (not a press-drag). `clickToPlace` means we're still waiting on the
      // first pointer-up to decide — a real drag commits as usual, a plain
      // click flips to `following`, where the endpoint trails the cursor and
      // the NEXT click places it. Absent for normal anchor drags.
      clickToPlace?: boolean;
      following?: boolean;
      // Where the pointer actually went DOWN, for the click-vs-drag test.
      // Distinct from startClient* in click-to-place mode, where startClient
      // is anchored to the element's anchor (not the far-out ring button).
      pressClientX?: number;
      pressClientY?: number;
      // True when the user is repositioning an EXISTING arrow's endpoint
      // (a deliberate manual correction), as opposed to drawing a new
      // arrow. A reposition that lands on an anchor marks the endpoint
      // `manual` so auto-rebind leaves it alone thereafter (spec/20).
      reposition?: boolean;
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
      // Index into the arrow's `curvePoints` when dragging a specific
      // control point of a multi-bend curve. Undefined = the legacy single
      // `curveOffset` bow handle.
      pointIndex?: number;
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
    };
