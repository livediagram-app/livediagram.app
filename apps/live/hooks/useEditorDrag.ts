// Drag state machine for the canvas, lifted out of editor-page.tsx so
// the editor route stays focused on top-level orchestration and the
// drag math can be reasoned about (and tested) on its own. Pure
// behavioural extraction: every dispatcher and the global pointer-
// move / pointer-up effect are unchanged from their previous inline
// shape; only the surrounding closure has changed.
//
// Why a hook (not a lib helper): the drag state IS React state
// (setDrag triggers re-render so the wrapper element renders with the
// right cursor + the resize handles see the live drag), and the
// pointer-move effect attaches global listeners that have to be torn
// down via the effect-cleanup convention. Both are React-shaped, so
// they belong in a hook rather than a pure module.
//
// Why a deps ref: the pointer-move effect's listeners need to read
// `activeTab.elements`, `tick`, `zoomRef`, etc. on every move event,
// but we don't want to re-attach those listeners every render. A ref
// gives the effect a stable hook (one attach per drag start) plus a
// fresh view of the parent state on every fire. The previous inline
// shape used an `// eslint-disable-next-line react-hooks/exhaustive-deps`
// comment for the same reason; the ref is the lint-clean version of
// that pattern.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  acceptsInlineIcon,
  alignmentGuides,
  distributionSnap,
  anchorPosition,
  angledElbow,
  arrowLabelAnchor,
  arrowStyleOf,
  curveAnchorPoints,
  curveControlPoint,
  endpointPosition,
  projectToArrow,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  selectionMembers,
  snapResizeBounds,
  snapToAlignment,
  snapToAnchor,
  type AlignmentGuide,
  type DistributionGuide,
  type Anchor,
  type ArrowElement,
  type Element,
  type Endpoint,
  type Tab,
} from '@livediagram/diagram';
import { titleCaseType, track } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import { getTheme } from '@/lib/themes';
import {
  ALIGN_SNAP_THRESHOLD,
  cornerOf,
  snapModeOf,
  MIN_SIZE,
  nextBounds,
  snapRotation,
  SNAP_THRESHOLD,
  unionOfBounds,
  unionResizeMember,
  withFrameContents,
  type ArrowEnd,
  type DragMode,
  type DragState,
  type ShapeBounds,
} from '@/lib/canvas';

// Value-equality for two guide lists. Used to bail out of the
// snapGuides state update when the guides haven't changed: on the vast
// majority of drag frames `alignmentGuides` returns an empty list (no
// snap), and feeding a fresh `[]` to setState every pointermove would
// force a redundant re-render of the whole editor tree on top of the
// per-frame `tick`. Returning the previous reference from the setState
// updater lets React skip the render entirely (Object.is bail-out).
// Stable empty exclude-set for arrow-endpoint alignment: an arrow isn't a
// boxed element so it's never an alignment TARGET, and we want it to line
// up against every boxed element. Module-level so the per-frame snap /
// guide calls don't allocate a fresh Set each tick.
const NO_ALIGN_EXCLUDE: Set<string> = new Set();

function sameGuides(a: AlignmentGuide[], b: AlignmentGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.position !== y.position || x.start !== y.start || x.end !== y.end) {
      return false;
    }
  }
  return true;
}

// Value-equality for two distribution-guide lists (axis / gap / spans),
// so the rAF setter can bail when they haven't changed.
function sameDistGuides(a: DistributionGuide[], b: DistributionGuide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.axis !== y.axis || x.gap !== y.gap || x.spans.length !== y.spans.length) return false;
    for (let j = 0; j < x.spans.length; j++) {
      const s = x.spans[j]!;
      const t = y.spans[j]!;
      if (s.from !== t.from || s.to !== t.to || s.cross !== t.cross) return false;
    }
  }
  return true;
}

// Distance from point p to segment a-b (canvas coords). Used to pick which
// segment of a multi-bend curve a click lands on so a new control point is
// inserted in the right place.
function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  const t =
    lenSq < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  const cx = a.x + t * vx;
  const cy = a.y + t * vy;
  return Math.hypot(p.x - cx, p.y - cy);
}

// Screen-pixel distance the pointer must travel before a body drag
// actually starts moving the element. Below this a press (even one that
// wobbles a few pixels) just selects / opens the element for editing —
// it never nudges it. Distance-based, not time-based: a fast flick still
// covers far more than this, so real drags engage immediately. Resize /
// rotate / arrow-endpoint grabs are deliberate handle pulls and aren't
// gated.
const DRAG_ENGAGE_PX = 4;

// The corner / edge OPPOSITE each resize handle, in element-local sign space
// (±1 per axis from the centre). Used to anchor that point while resizing a
// rotated element so it grows from the dragged side only, not the centre.
const FIXED_SIGN: Partial<Record<DragMode, { sx: number; sy: number }>> = {
  'resize-e': { sx: -1, sy: 0 },
  'resize-w': { sx: 1, sy: 0 },
  'resize-s': { sx: 0, sy: -1 },
  'resize-n': { sx: 0, sy: 1 },
  'resize-se': { sx: -1, sy: -1 },
  'resize-sw': { sx: 1, sy: -1 },
  'resize-ne': { sx: -1, sy: 1 },
  'resize-nw': { sx: 1, sy: 1 },
};

// External state + callbacks the drag machine reads on every move.
// Bundled into one object so the hook signature doesn't sprout
// positional arguments as more inputs land; tracked via a ref so the
// move-effect doesn't re-attach listeners on every parent render.
type EditorDragDeps = {
  // The tab whose elements are being dragged. We read its elements
  // array on every move and write back through `tick` / `commit`.
  activeTab: Tab;
  // Current viewport zoom, kept in a ref so the move handler can
  // invert it without forcing the effect to re-attach when zoom
  // changes mid-drag.
  zoomRef: React.RefObject<number>;
  // Read-only selection state. Drag never sets selection directly
  // except through the supplied setter (so the parent owns the
  // truth).
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  isReadOnly: boolean;
  // Modal interaction state. When format-painter is active, a click
  // on an element applies the format instead of dragging; when
  // group-source is active, the click completes a grouping. The drag
  // dispatcher checks these and routes appropriately.
  formatSourceId: string | null;
  applyFormatFromSource: (targetId: string) => void;
  groupSourceId: string | null;
  completeGrouping: (targetId: string) => void;
  // Arrow click-to-connect (spec/09): armed source + the action.
  connectSourceId: string | null;
  connectArrowTo: (targetId: string) => void;
  // Element setters from the editor. `tick` writes elements without
  // taking a history checkpoint (used during the move-effect's
  // 60+/sec updates); `commit` writes elements AND snapshots history
  // (used at drag-begin to create the new arrow when an anchor is
  // pulled). `markCheckpoint` is the snapshot-without-write entry
  // point, used at the start of a boxed move/resize so a single
  // Cmd-Z undoes the whole gesture.
  tick: (mapper: (els: Element[]) => Element[]) => void;
  commit: (mapper: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  // Debounced activity-log emitter (see useActivityLogDebounce). Called
  // on every mutating tick of an edit gesture; the per-key 500ms window
  // collapses the whole drag into ONE entry that diffs pre-gesture vs
  // final state. A continuous move/resize never flushes mid-drag (each
  // tick resets the timer), so the panel gets one "Moved a Square", not
  // one row per frame.
  scheduleElementChangeLog: (key: string) => void;
  // A standalone icon shape was dragged + released over another (non-
  // icon) shape: fold it INTO that shape as an inline icon on the named
  // side, removing the standalone element (spec/09). Omitted when icon
  // edits are blocked (read-only / locked tab).
  onIconElementDroppedOnShape?: (
    sourceIconId: string,
    targetShapeId: string,
    position: 'left' | 'right' | 'above' | 'below',
  ) => void;
  // An annotation marker was pressed + released without moving (a click,
  // not a drag): open its note editor (spec/38). Distinguished from a drag
  // by the same DRAG_ENGAGE_PX travel test the icon-fold uses. Omitted when
  // note edits are blocked (read-only / locked tab).
  onAnnotationClicked?: (id: string) => void;
  // Per-user preference (spec/20) controlling whether connected
  // arrows re-pin to the most-natural face as a box is dragged.
  // Defaults to true; setting `false` keeps anchors frozen at
  // whatever the user originally chose. Tracked via ref so a
  // mid-drag toggle takes effect on the next pointermove without
  // re-attaching listeners.
  autoRebindArrowsRef: React.RefObject<boolean>;
  // Per-user preference (spec/09) controlling whether the faint
  // alignment guides are drawn during a move / resize. Defaults to
  // true; `false` suppresses the guide lines (the snap itself is
  // unaffected). Tracked via ref so a mid-drag toggle takes effect on
  // the next pointermove without re-attaching listeners.
  alignmentGuidesRef: React.RefObject<boolean>;
  // Set to true while a 2-finger pinch is active. The move handler
  // checks this and cancels any in-flight drag so a pinch-to-zoom
  // gesture that starts on an element doesn't also move it.
  isPinchingRef?: React.RefObject<boolean>;
};

type EditorDragApi = {
  drag: DragState | null;
  // Faint alignment guides for the in-progress move / resize: the edge
  // and centre lines the dragged element currently shares with its
  // neighbours, drawn so the user can see why it snapped. Empty when no
  // snap is in effect, and cleared on release. See `alignmentGuides`.
  snapGuides: AlignmentGuide[];
  // Equal-spacing guides for the in-progress move: the gap segments shown
  // when the element snaps to even spacing with its neighbours.
  distGuides: DistributionGuide[];
  beginDrag: (elementId: string, mode: DragMode, e: ReactPointerEvent) => void;
  beginRotate: (
    elementId: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => void;
  beginAnchorDrag: (
    elementId: string,
    anchor: Anchor,
    e: ReactPointerEvent,
    opts?: { clickToPlace?: boolean; placeOutPx?: number },
  ) => void;
  beginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  beginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  beginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  beginArrowCurvePointDrag: (arrowId: string, index: number, e: ReactPointerEvent) => void;
  addCurvePoint: (arrowId: string, canvasX: number, canvasY: number) => void;
  beginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  beginArrowLabelDrag: (arrowId: string, e: ReactPointerEvent) => void;
};

export function useEditorDrag(deps: EditorDragDeps): EditorDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  const [snapGuides, setSnapGuides] = useState<AlignmentGuide[]>([]);
  // Equal-spacing (distribution) guides: the gap segments shown when the
  // element snaps to even spacing with its neighbours. Rendered alongside
  // the alignment guides; coalesced through the same rAF below.
  const [distGuides, setDistGuides] = useState<DistributionGuide[]>([]);
  // Coalesce snap-guide state updates into a single rAF. The guides are
  // purely cosmetic — the snap itself is applied synchronously in the
  // `tick` below — so keeping their state update OFF the synchronous
  // pointermove path (which fired setSnapGuides + tick back-to-back every
  // frame) keeps the guide overlay out of the critical drag render and
  // out of any synchronous update cascade. A pending frame is cancelled +
  // rescheduled so only the latest guides land; the sameGuides guard then
  // skips the render when they're unchanged.
  const guideRafRef = useRef<number | null>(null);
  // Whether the current body drag has crossed DRAG_ENGAGE_PX. Reset at the
  // start of each gesture (in the move effect below); flipped true once the
  // pointer travels far enough that the press is unambiguously a drag.
  const dragEngagedRef = useRef(false);
  // A begin* handler ARMS a checkpoint here instead of taking it at
  // pointer-down. It's flushed lazily on the first real `tick` (the first
  // actual mutation) in the move effect below, so a plain click that
  // selects an element — or a press on a locked element / tab that never
  // mutates — leaves the undo history untouched. Taking the checkpoint at
  // pointer-down pushed a no-op snapshot (and cleared the redo stack) on
  // every click, evicting real states under the 3-deep HISTORY_LIMIT.
  const checkpointPendingRef = useRef(false);
  // True for the duration of a gesture that edits EXISTING elements
  // (move / resize / rotate / arrow-handle), gating the activity-log
  // emit. Set when the armed checkpoint is flushed on the first real
  // tick; reset on pointer-up. Stays false for arrow creation-on-drag
  // (beginAnchorDrag), which never arms a checkpoint because it already
  // logged an "Added" entry via `commit` — so we don't double-log it.
  const logGestureRef = useRef(false);
  const scheduleGuides = (align: AlignmentGuide[], dist: DistributionGuide[] = []) => {
    if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
    guideRafRef.current = requestAnimationFrame(() => {
      guideRafRef.current = null;
      setSnapGuides((prev) => (sameGuides(prev, align) ? prev : align));
      setDistGuides((prev) => (sameDistGuides(prev, dist) ? prev : dist));
    });
  };
  useEffect(
    () => () => {
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
    },
    [],
  );

  // Stash deps on every render so the move-effect always reads
  // fresh values without re-subscribing global pointer listeners.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    const d = depsRef.current;
    // Arrow click-to-connect (spec/09): same "armed source, next click
    // is the action" shape as format-paint / group below. Draws a
    // pinned connector to the clicked shape instead of selecting it.
    if (d.connectSourceId !== null && mode === 'move') {
      d.connectArrowTo(elementId);
      return;
    }
    if (d.formatSourceId !== null && mode === 'move') {
      d.applyFormatFromSource(elementId);
      return;
    }
    if (d.groupSourceId !== null && mode === 'move') {
      d.completeGrouping(elementId);
      return;
    }
    if (d.editingId === elementId) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    d.setSelectedId(elementId);
    // Selection above still lands so viewers can inspect; the drag
    // itself is blocked for a locked element or a read-only session.
    if (element.locked === true || d.isReadOnly) return;

    // Multi-selection AND group selection both drag in lockstep: for
    // 'move' the whole set translates together, for 'resize-*' the
    // whole set scales together (members reposition + resize
    // proportionally around the corner opposite the drag handle). A
    // bare single-element drag falls through to the singleton set.
    const baseIds = d.multiSelectedIds.has(elementId)
      ? d.multiSelectedIds
      : element.groupId
        ? new Set(selectionMembers(d.activeTab.elements, elementId))
        : new Set<string>([elementId]);

    // Frame sections (spec/09): MOVING a frame carries everything inside
    // it. Expand the move set with every boxed element whose centre lies
    // within a frame being moved (pinned arrows between them follow via
    // the rebind pass). Resizing is deliberately excluded — a frame
    // resize re-sizes the section outline and leaves its contents put.
    const ids = mode === 'move' ? withFrameContents(d.activeTab.elements, baseIds) : baseIds;

    const startBounds = new Map<string, ShapeBounds>();
    // Free endpoints of any arrows the frame-section expansion pulled in, so
    // their free ends translate with the section (only relevant for a move).
    const startArrowEnds = new Map<
      string,
      { from?: { x: number; y: number }; to?: { x: number; y: number } }
    >();
    for (const el of d.activeTab.elements) {
      if (!ids.has(el.id)) continue;
      if (isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      } else if (el.type === 'arrow') {
        startArrowEnds.set(el.id, {
          from: el.from.kind === 'free' ? { x: el.from.x, y: el.from.y } : undefined,
          to: el.to.kind === 'free' ? { x: el.to.x, y: el.to.y } : undefined,
        });
      }
    }

    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      startArrowEnds,
      aspectLocked: element.aspectLocked === true,
    });
  };

  // Rotate-handle drag. The caller passes the element's centre in
  // client coords (read off the wrapper's bounding rect at grab time)
  // so the move handler can sweep angles in screen space without
  // threading the viewport offset through here.
  const beginRotate = (
    elementId: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    d.setSelectedId(elementId);
    if (element.locked === true || d.isReadOnly) return;
    const startPointerAngle = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    // Emit at gesture start (same pragmatism as beginAnchorDrag's
    // Added/Arrow): a proxy for "the user reached for rotation". The
    // `type` reuses the Added vocab (shape kind, else element kind).
    track(
      'Element',
      'Rotated',
      titleCaseType(element.type === 'shape' ? element.shape : element.type),
    );
    setDrag({
      kind: 'rotate',
      elementId,
      centerClientX,
      centerClientY,
      startPointerAngle,
      startRotation: element.rotation ?? 0,
    });
  };

  const beginAnchorDrag = (
    elementId: string,
    anchor: Anchor,
    e: ReactPointerEvent,
    opts?: { clickToPlace?: boolean; placeOutPx?: number },
  ) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element) || element.locked === true || d.isReadOnly) return;
    const start = anchorPosition(element, anchor);
    // A connector drawn FROM a shape inherits that shape's stroke so it
    // visually belongs with it — and so it respects whatever theme the
    // shape already carries (the tab's `theme` field can lag a recolour,
    // which is why these arrows were coming out black). Falls back to
    // the tab theme's element stroke, then the built-in arrow default.
    const theme = getTheme(d.activeTab.theme);
    const inheritedStroke = element.strokeColor ?? theme.elementStroke ?? undefined;
    // placeOutPx (mobile Arrow option): don't enter a drag — drop a free
    // arrow that runs straight out from the anchor by that many px and
    // select it so the user can reposition it by hand.
    if (opts?.placeOutPx) {
      const out: Record<Anchor, { x: number; y: number }> = {
        n: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        e: { x: 1, y: 0 },
        w: { x: -1, y: 0 },
        ne: { x: 0.707, y: -0.707 },
        nw: { x: -0.707, y: -0.707 },
        se: { x: 0.707, y: 0.707 },
        sw: { x: -0.707, y: 0.707 },
      };
      const dir = out[anchor];
      const placed: ArrowElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: { kind: 'pinned', elementId, anchor },
        to: {
          kind: 'free',
          x: start.x + dir.x * opts.placeOutPx,
          y: start.y + dir.y * opts.placeOutPx,
        },
        ...(inheritedStroke ? { strokeColor: inheritedStroke } : {}),
      };
      d.commit((els) => [...els, placed]);
      d.setSelectedId(placed.id);
      track('Element', 'Added', 'Arrow');
      return;
    }
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId, anchor },
      to: { kind: 'free', x: start.x, y: start.y },
      ...(inheritedStroke ? { strokeColor: inheritedStroke } : {}),
    };
    d.commit((els) => [...els, arrow]);
    d.setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
    // The move handler tracks (startCanvas + (client - startClient)). For a
    // press-drag from the anchor handle the pointer IS at the anchor, so
    // e.client is the right origin. A click-to-place from the ring starts
    // far out on the ring button, so anchor that origin to the anchor's
    // own screen position instead (derived from the element's DOM rect) —
    // otherwise the endpoint would trail the cursor by the button offset.
    let startClientX = e.clientX;
    let startClientY = e.clientY;
    if (opts?.clickToPlace && element.width > 0 && element.height > 0) {
      const node = document.querySelector(`[data-element-id="${elementId}"]`);
      if (node) {
        const r = node.getBoundingClientRect();
        startClientX = r.left + ((start.x - element.x) / element.width) * r.width;
        startClientY = r.top + ((start.y - element.y) / element.height) * r.height;
      }
    }
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX,
      startClientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
      clickToPlace: opts?.clickToPlace ?? false,
      pressClientX: e.clientX,
      pressClientY: e.clientY,
    });
  };

  // Shared opening for every arrow-handle drag: refuse to start while a
  // format-painter or group-paste gesture is live, then resolve the
  // target as a typed arrow. Returns the deps snapshot + arrow, or null
  // when the drag shouldn't begin. The setSelectedId / locked / style
  // guards stay per-handler because their order differs between gestures.
  const resolveArrowDrag = (arrowId: string) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return null;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return null;
    return { d, arrow };
  };

  const beginArrowTranslate = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrow.locked === true || d.isReadOnly) return;
    if (arrow.from.kind !== 'free' || arrow.to.kind !== 'free') return;
    d.setSelectedId(arrowId);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-translate',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFromX: arrow.from.x,
      startFromY: arrow.from.y,
      startToX: arrow.to.x,
      startToY: arrow.to.y,
    });
  };

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const start = endpointPosition(end === 'from' ? arrow.from : arrow.to, d.activeTab.elements);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-endpoint',
      arrowId,
      end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
      // Repositioning an existing endpoint is a manual correction: if it
      // lands on an anchor, mark it `manual` so auto-rebind leaves it.
      reposition: true,
    });
  };

  const beginArrowCurveDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrowStyleOf(arrow) !== 'curved') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const control = curveControlPoint(from, to, arrow.curveOffset);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-curve',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidX: (from.x + to.x) / 2,
      startMidY: (from.y + to.y) / 2,
      // The cursor isn't always exactly on the control point at
      // grab time (the SVG handle has a 10px hit area). Storing the
      // cursor-to-control delta lets the move handler keep the
      // handle anchored to where the user originally clicked,
      // matching native drag UX.
      grabDx: control.x - (from.x + to.x) / 2,
      grabDy: control.y - (from.y + to.y) / 2,
    });
  };

  // Drag one control point of a multi-bend curve (curvePoints[index]). Same
  // gesture as beginArrowCurveDrag but anchored to that point + tagged with
  // its index so the tick writes back into the array slot.
  const beginArrowCurvePointDrag = (arrowId: string, index: number, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrowStyleOf(arrow) !== 'curved' || !arrow.curvePoints?.[index]) return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const anchor = curveAnchorPoints(from, to, arrow.curvePoints)[index]!;
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-curve',
      arrowId,
      pointIndex: index,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidX: (from.x + to.x) / 2,
      startMidY: (from.y + to.y) / 2,
      grabDx: anchor.x - (from.x + to.x) / 2,
      grabDy: anchor.y - (from.y + to.y) / 2,
    });
  };

  // Insert a control point at a clicked canvas position, so clicking an
  // arrow's line adds a bend. Works on ANY arrow style: a straight or angled
  // arrow is switched to a smooth curve at the same time (the user clicked
  // the line to bend it). A curve with an existing bow keeps its shape (the
  // bow is seeded as a point first). The new point lands in the nearest
  // segment of the from -> points -> to polyline so it inserts where clicked.
  const addCurvePoint = (arrowId: string, canvasX: number, canvasY: number) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrow.locked === true || d.isReadOnly) return;
    const els = d.activeTab.elements;
    const from = endpointPosition(arrow.from, els);
    const to = endpointPosition(arrow.to, els);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const currentStyle = arrowStyleOf(arrow);
    // Preserve the arrow's style: an angled arrow gains another bend (stays a
    // polyline), a curved arrow gains a smooth control point. Only a straight
    // arrow has no bend concept, so it becomes a curve. Seed from the existing
    // single bend (bow / elbow) so adding a point doesn't reset the shape.
    const seeded =
      arrow.curvePoints && arrow.curvePoints.length > 0
        ? arrow.curvePoints.slice()
        : currentStyle === 'curved'
          ? (() => {
              const c = curveControlPoint(from, to, arrow.curveOffset);
              return [{ dx: c.x - mx, dy: c.y - my }];
            })()
          : currentStyle === 'angled'
            ? (() => {
                const elb = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
                return [{ dx: elb.x - mx, dy: elb.y - my }];
              })()
            : [];
    const nextStyle = currentStyle === 'straight' ? 'curved' : currentStyle;
    const anchors = [from, ...curveAnchorPoints(from, to, seeded), to];
    // Nearest segment of the anchor polyline → insert index in `seeded`.
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < anchors.length - 1; i++) {
      const dist = distToSegment({ x: canvasX, y: canvasY }, anchors[i]!, anchors[i + 1]!);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    const next = seeded.slice();
    next.splice(best, 0, { dx: canvasX - mx, dy: canvasY - my });
    d.commit((all) =>
      all.map((el) =>
        el.id === arrowId && el.type === 'arrow'
          ? { ...el, arrowStyle: nextStyle, curvePoints: next }
          : el,
      ),
    );
    d.setSelectedId(arrowId);
  };

  // Elbow-handle drag for angled arrows. Same gesture shape as
  // beginArrowCurveDrag but stores the auto-elbow (the corner the
  // angled-arrow renderer would draw without offset) as the
  // baseline. On move we compute a fresh elbowOffset as
  // `(currentElbow - startBase)`, so the elbow lands wherever the
  // cursor goes and the value is preserved when endpoints later
  // move.
  const beginArrowElbowDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    if (arrowStyleOf(arrow) !== 'angled') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const baseElbow = angledElbow(from, to, arrow.from, arrow.to);
    const currentElbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-elbow',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBaseX: baseElbow.x,
      startBaseY: baseElbow.y,
      // Pointer-to-elbow offset at grab time, same trick as
      // beginArrowCurveDrag so the handle tracks the cursor cleanly.
      grabDx: currentElbow.x - baseElbow.x,
      grabDy: currentElbow.y - baseElbow.y,
    });
  };

  // Label drag: the user grabbed an arrow's text label and is sliding
  // it along the line / to either side. We capture the label's current
  // anchor point so the move handler tracks `anchor + pointer delta`
  // and projects it back onto the line into a {t, offset} placement.
  const beginArrowLabelDrag = (arrowId: string, e: ReactPointerEvent) => {
    const r = resolveArrowDrag(arrowId);
    if (!r) return;
    const { d, arrow } = r;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const anchor = arrowLabelAnchor(
      arrowStyleOf(arrow),
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'arrow-label',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startAnchorX: anchor.x,
      startAnchorY: anchor.y,
    });
  };

  // Global pointer-move / pointer-up listeners. Attached once per
  // drag-start, torn down when the drag ends. Every fire reads
  // through depsRef so an external state change (zoom, selection,
  // active-tab swap) is reflected without re-attaching.
  useEffect(() => {
    if (!drag) return;
    // Each new gesture starts un-engaged: a body move must cross
    // DRAG_ENGAGE_PX before it nudges anything (see the move branch).
    dragEngagedRef.current = false;
    // Cancel the drag immediately when a second touch finger lands — that
    // signals a pinch gesture, not a solo drag.
    const onSecondTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !e.isPrimary) {
        setDrag(null);
        scheduleGuides([]);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (depsRef.current.isPinchingRef?.current) {
        setDrag(null);
        scheduleGuides([]);
        return;
      }
      const { activeTab, zoomRef } = depsRef.current;
      // Flush the armed checkpoint on the FIRST real mutation of the
      // gesture (every branch below writes through this `tick`), so a
      // press that never mutates leaves history untouched. After the
      // first flush it's a plain passthrough for the rest of the drag.
      const tick = (mapper: (els: Element[]) => Element[]) => {
        if (checkpointPendingRef.current) {
          depsRef.current.markCheckpoint();
          checkpointPendingRef.current = false;
          // A checkpoint was armed → this is an edit of existing
          // elements, so it earns an activity-log entry. (Arrow
          // creation-on-drag never arms one; it stays out.)
          logGestureRef.current = true;
        }
        depsRef.current.tick(mapper);
        // Re-arm the 500ms debounce on every mutating tick so the entry
        // lands once, after the gesture settles, diffing pre-gesture vs
        // final state. One shared key per drag → distinct gestures stay
        // distinct unless they overlap the window.
        if (logGestureRef.current) depsRef.current.scheduleElementChangeLog('element-drag');
      };
      // Screen-pixel delta into canvas-coord delta (invert the
      // current zoom).
      if (drag.kind === 'rotate') {
        // Sweep the element's rotation by the angle the pointer has
        // travelled around the centre since grab. Shift bypasses the
        // 15-degree snap for fine control.
        const angle = Math.atan2(e.clientY - drag.centerClientY, e.clientX - drag.centerClientX);
        const deltaDeg = ((angle - drag.startPointerAngle) * 180) / Math.PI;
        const next = snapRotation(drag.startRotation + deltaDeg, e.shiftKey);
        tick((els) =>
          els.map((el) =>
            el.id === drag.elementId && isBoxed(el) ? { ...el, rotation: next } : el,
          ),
        );
        return;
      }

      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;

      if (drag.kind === 'boxed') {
        if (drag.mode === 'move') {
          // Drag-engage threshold: until the pointer has travelled past
          // DRAG_ENGAGE_PX (screen space), treat the press as a click —
          // select / open-to-edit without moving anything. Once engaged it
          // tracks the full delta from the start, so there's no jump.
          if (!dragEngagedRef.current) {
            const travelled = Math.hypot(
              e.clientX - drag.startClientX,
              e.clientY - drag.startClientY,
            );
            if (travelled < DRAG_ENGAGE_PX) return;
            dragEngagedRef.current = true;
          }
          // Snap the primary's candidate bounds to align with other
          // elements' edges / centres; apply the same nudge to every
          // group member so they translate together.
          const primaryStart = drag.startBounds.get(drag.primaryId);
          const memberIds = new Set(drag.startBounds.keys());
          let snapDx = 0;
          let snapDy = 0;
          if (primaryStart) {
            const candidate = {
              x: primaryStart.x + dx,
              y: primaryStart.y + dy,
              width: primaryStart.width,
              height: primaryStart.height,
            };
            const snap = snapToAlignment(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            snapDx = snap.dx;
            snapDy = snap.dy;
            // Equal-spacing (distribution) snap fills the axes alignment
            // didn't already claim, so the element lands evenly spaced
            // between / beyond its neighbours. Alignment (edge / centre)
            // wins per axis when both are in range.
            const dist = distributionSnap(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            // Distribution fills only the axes alignment didn't claim.
            // Keyed off snap.snappedX/Y (not snapDx === 0) so an EXACT
            // edge alignment, whose delta is 0, still wins over an
            // equal-spacing nudge that's also in range.
            if (!snap.snappedX) snapDx = dist.dx;
            if (!snap.snappedY) snapDy = dist.dy;
            // Derive guides from the SNAPPED primary bounds so a line
            // only appears once the snap has aligned an edge / centre.
            // Suppressed entirely when the user has turned guides off
            // (the snap above still applies; only the hint is hidden).
            const guidesOn = depsRef.current.alignmentGuidesRef.current ?? true;
            const guides = guidesOn
              ? alignmentGuides(
                  { ...candidate, x: candidate.x + snapDx, y: candidate.y + snapDy },
                  activeTab.elements,
                  memberIds,
                )
              : [];
            // Distribution guides only for the axis distribution actually
            // drove (alignment didn't already claim it).
            const distOut = guidesOn
              ? dist.guides.filter((g) =>
                  g.axis === 'x'
                    ? !snap.snappedX && dist.dx !== 0
                    : !snap.snappedY && dist.dy !== 0,
                )
              : [];
            scheduleGuides(guides, distOut);
          } else {
            scheduleGuides([]);
          }
          tick((els) => {
            // First pass: translate every dragged boxed element, and the
            // FREE endpoints of any arrows pulled into a frame-section move
            // (pinned ends are left for the rebind pass below).
            const moved = els.map((el) => {
              if (isBoxed(el)) {
                const start = drag.startBounds.get(el.id);
                if (!start) return el;
                return { ...el, x: start.x + dx + snapDx, y: start.y + dy + snapDy };
              }
              if (el.type === 'arrow') {
                const ends = drag.startArrowEnds.get(el.id);
                if (!ends) return el;
                const next = { ...el };
                if (ends.from && el.from.kind === 'free') {
                  next.from = {
                    kind: 'free',
                    x: ends.from.x + dx + snapDx,
                    y: ends.from.y + dy + snapDy,
                  };
                }
                if (ends.to && el.to.kind === 'free') {
                  next.to = {
                    kind: 'free',
                    x: ends.to.x + dx + snapDx,
                    y: ends.to.y + dy + snapDy,
                  };
                }
                return next;
              }
              return el;
            });
            // Second pass: re-pin connected arrow anchors against
            // the moved positions so an arrow stays visually
            // attached as the user drags. Skipped when the per-
            // user preference (spec/20) is off, in which case
            // anchors stay frozen at whatever the user originally
            // chose. Read through a ref so a mid-drag flip lands
            // on the next pointermove without re-attaching.
            const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? true;
            return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
          });
        } else {
          // Resize branch handles BOTH single-element and group /
          // multi resizes uniformly:
          // - Single member: scale the lone member directly via
          //   nextBounds (the original behaviour, snapping included).
          // - Multiple members: compute a UNION start box, scale
          //   that as if it were one element, then map every member
          //   through the same proportional scale around the anchor
          //   (corner opposite the drag handle).
          const corner = cornerOf(drag.mode);
          // Corner OR single edge — so edge resizes snap + dimension-match
          // on their axis (multi-member scaling below stays corner-only).
          const snapMode = snapModeOf(drag.mode);
          const memberIds = new Set(drag.startBounds.keys());

          // Shift-held during resize is the standard "constrain
          // aspect" modifier (Figma, Photoshop, Illustrator). It
          // works on top of the per-element aspectLocked toggle: a
          // shape with the toggle off honours the shift; a shape
          // with the toggle on stays locked regardless.
          const constrain = drag.aspectLocked || e.shiftKey;
          if (drag.startBounds.size <= 1) {
            const start = drag.startBounds.get(drag.primaryId);
            if (!start) return;
            const primary = activeTab.elements.find((el) => el.id === drag.primaryId);
            const rotation = (primary && isBoxed(primary) ? primary.rotation : 0) ?? 0;
            if (rotation) {
              // Rotated: project the screen drag into the element's local
              // (unrotated) frame so the size changes along its own axes,
              // then keep the edge / corner OPPOSITE the handle visually
              // fixed — so it grows from the dragged side only, not the
              // centre. (Axis-aligned snapping doesn't apply to a rotated
              // box.) FIXED_SIGN points at that opposite anchor in local
              // coords (±half-width, ±half-height).
              const r = (rotation * Math.PI) / 180;
              const cos = Math.cos(r);
              const sin = Math.sin(r);
              const dxl = dx * cos + dy * sin;
              const dyl = -dx * sin + dy * cos;
              const sized = nextBounds(start, drag.mode, dxl, dyl, constrain);
              const sign = FIXED_SIGN[drag.mode] ?? { sx: 0, sy: 0 };
              const cx0 = start.x + start.width / 2;
              const cy0 = start.y + start.height / 2;
              // World position of the fixed anchor before the resize.
              const ax0 = (sign.sx * start.width) / 2;
              const ay0 = (sign.sy * start.height) / 2;
              const anchorX = cx0 + (ax0 * cos - ay0 * sin);
              const anchorY = cy0 + (ax0 * sin + ay0 * cos);
              // Same anchor after the resize, relative to the new centre.
              const ax1 = (sign.sx * sized.width) / 2;
              const ay1 = (sign.sy * sized.height) / 2;
              const cx1 = anchorX - (ax1 * cos - ay1 * sin);
              const cy1 = anchorY - (ax1 * sin + ay1 * cos);
              const next = {
                x: cx1 - sized.width / 2,
                y: cy1 - sized.height / 2,
                width: sized.width,
                height: sized.height,
              };
              scheduleGuides([]);
              tick((els) =>
                els.map((el) =>
                  el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el,
                ),
              );
              return;
            }
            const raw = nextBounds(start, drag.mode, dx, dy, constrain);
            const next =
              !constrain && snapMode
                ? snapResizeBounds(
                    raw,
                    snapMode,
                    activeTab.elements,
                    memberIds,
                    ALIGN_SNAP_THRESHOLD,
                    MIN_SIZE,
                  )
                : raw;
            // Guide off the snapped bounds (same rationale as move). A
            // constrained resize skips the snap, so guides only appear
            // when an edge / centre genuinely lines up. Suppressed when
            // the user has turned alignment guides off.
            const guides =
              (depsRef.current.alignmentGuidesRef.current ?? true)
                ? alignmentGuides(next, activeTab.elements, memberIds)
                : [];
            scheduleGuides(guides);
            tick((els) =>
              els.map((el) => (el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el)),
            );
            return;
          }

          // Multi-member resize: derive union bounds, run them
          // through nextBounds, and scale every member around the
          // anchor (corner opposite the drag handle). Aspect-lock is
          // forced on if ANY member is aspect-locked so locked
          // figures (e.g. the actor) don't get warped by an
          // unevenly-dragged corner. Snap is skipped for multi-
          // resize because the primary's edges aren't load-bearing
          // here: snapping one member's edge would push the whole
          // group around in ways the user didn't ask for.
          const unionStart = unionOfBounds(drag.startBounds.values());
          if (!unionStart || !corner) return;
          const anyAspectLocked = activeTab.elements.some(
            (el) => isBoxed(el) && drag.startBounds.has(el.id) && el.aspectLocked === true,
          );
          // Shift-held forces constrain for multi-resize too, on
          // top of the per-element flags. Any aspect-locked member
          // already forces constrain to avoid warping (e.g. an
          // actor inside the selection) so this just adds the
          // user's modifier-key opt-in for unlocked selections.
          const unionNext = nextBounds(
            unionStart,
            drag.mode,
            dx,
            dy,
            drag.aspectLocked || anyAspectLocked || e.shiftKey,
          );
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, ...unionResizeMember(start, unionStart, unionNext, corner) };
            }),
          );
        }
        return;
      }

      if (drag.kind === 'arrow-curve') {
        // The control point should sit at `pointer + grab`, where
        // grab is the pointer-to-control delta we captured on
        // gesture start. Translating that into a curveOffset means
        // subtracting the chord midpoint (also captured at start so
        // a concurrent endpoint move doesn't yank the curve).
        const controlX = drag.startMidX + drag.grabDx + dx;
        const controlY = drag.startMidY + drag.grabDy + dy;
        const offsetDx = controlX - drag.startMidX;
        const offsetDy = controlY - drag.startMidY;
        const pointIndex = drag.pointIndex;
        tick((els) =>
          els.map((el) => {
            if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
            // Multi-bend: write the dragged control point's slot; otherwise
            // the legacy single bow.
            if (pointIndex != null && el.curvePoints) {
              const next = el.curvePoints.slice();
              if (!next[pointIndex]) return el;
              next[pointIndex] = { dx: offsetDx, dy: offsetDy };
              return { ...el, curvePoints: next };
            }
            return { ...el, curveOffset: { dx: offsetDx, dy: offsetDy } };
          }),
        );
        return;
      }

      if (drag.kind === 'arrow-elbow') {
        // Same shape as arrow-curve, but for the angled-arrow elbow
        // handle. The new elbow sits at `pointer + grab` (where
        // grab is the cursor-to-elbow delta at gesture start), and
        // we store it as a delta from the auto-elbow position so
        // the bend survives concurrent endpoint moves the same way
        // the curveOffset does.
        const elbowX = drag.startBaseX + drag.grabDx + dx;
        const elbowY = drag.startBaseY + drag.grabDy + dy;
        const offsetDx = elbowX - drag.startBaseX;
        const offsetDy = elbowY - drag.startBaseY;
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow'
              ? { ...el, elbowOffset: { dx: offsetDx, dy: offsetDy } }
              : el,
          ),
        );
        return;
      }

      if (drag.kind === 'arrow-label') {
        // The dragged point is the label's grab-time anchor plus the
        // pointer delta; project it onto the line to get the new
        // {t, offset} placement (stays attached to the line, either
        // side). Resolve endpoints fresh so it survives endpoint moves.
        const arrow = activeTab.elements.find((el) => el.id === drag.arrowId);
        if (!arrow || arrow.type !== 'arrow') return;
        const from = endpointPosition(arrow.from, activeTab.elements);
        const to = endpointPosition(arrow.to, activeTab.elements);
        const point = { x: drag.startAnchorX + dx, y: drag.startAnchorY + dy };
        const labelOffset = projectToArrow(
          arrowStyleOf(arrow),
          from,
          to,
          arrow.from,
          arrow.to,
          arrow.curveOffset,
          arrow.elbowOffset,
          point,
          arrow.curvePoints,
        );
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow' ? { ...el, labelOffset } : el,
          ),
        );
        return;
      }

      if (drag.kind === 'arrow-translate') {
        // Shift both free endpoints by the same canvas delta from
        // their captured start positions. No anchor / angle snap:
        // the user explicitly chose a fully-floating arrow.
        tick((els) =>
          els.map((el) => {
            if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
            return {
              ...el,
              from: { kind: 'free', x: drag.startFromX + dx, y: drag.startFromY + dy },
              to: { kind: 'free', x: drag.startToX + dx, y: drag.startToY + dy },
            };
          }),
        );
        return;
      }

      // arrow-endpoint: pin to an anchor if the cursor is close,
      // otherwise free + optional 45-degree angle snap from the
      // other endpoint.
      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      const els0 = depsRef.current.activeTab.elements;
      // Element anchor wins over angle / alignment snap: pinning to
      // another shape is the strongest constraint and the most desirable
      // outcome when both are plausible.
      const anchorSnap = snapToAnchor(cursor, els0, SNAP_THRESHOLD);
      let endpoint: Endpoint;
      if (anchorSnap) {
        endpoint = {
          kind: 'pinned',
          elementId: anchorSnap.elementId,
          anchor: anchorSnap.anchor,
          // A hand-repositioned endpoint that lands on an anchor is a manual
          // override; auto-rebind then leaves this end's face alone.
          ...(drag.reposition ? { manual: true } : {}),
        };
        scheduleGuides([]);
      } else {
        // Angle snap: lock the arrow to 45-degree increments from its
        // other endpoint when the cursor is within ~5 degrees of one.
        // Keeps right-angle connectors easy to draw without fighting the
        // cursor at oblique angles.
        const arrow = els0.find((e) => e.id === drag.arrowId && e.type === 'arrow') as
          | ArrowElement
          | undefined;
        let resolved = cursor;
        let angleLocked = false;
        let other: { x: number; y: number } | null = null;
        if (arrow) {
          const otherKey = drag.end === 'from' ? 'to' : 'from';
          other = endpointPosition(arrow[otherKey], els0);
          const ax = cursor.x - other.x;
          const ay = cursor.y - other.y;
          const len = Math.hypot(ax, ay);
          if (len > 0) {
            const angle = Math.atan2(ay, ax);
            const STEP = Math.PI / 4;
            const THRESH = (5 * Math.PI) / 180;
            const nearest = Math.round(angle / STEP) * STEP;
            if (Math.abs(angle - nearest) <= THRESH) {
              resolved = {
                x: other.x + Math.cos(nearest) * len,
                y: other.y + Math.sin(nearest) * len,
              };
              angleLocked = true;
            }
          }
        }
        // Alignment snapping for the free endpoint (skipped once the 45°
        // angle lock already constrains it): nudge the point to line up
        // with nearby boxed elements' edges / centres AND with the arrow's
        // OTHER endpoint (so it clicks into a perfectly horizontal /
        // vertical line), showing the same faint guides a boxed move does.
        const guidesOn = depsRef.current.alignmentGuidesRef.current ?? true;
        if (!angleLocked) {
          const boxSnap = snapToAlignment(
            { x: resolved.x, y: resolved.y, width: 0, height: 0 },
            els0,
            NO_ALIGN_EXCLUDE,
            ALIGN_SNAP_THRESHOLD,
          );
          resolved = { x: resolved.x + boxSnap.dx, y: resolved.y + boxSnap.dy };
          const extraGuides: AlignmentGuide[] = [];
          // Endpoint-to-other-endpoint alignment fills the axes the box
          // snap didn't claim, so a near-straight arrow latches truly
          // straight with a guide spanning the two ends.
          if (other) {
            if (!boxSnap.snappedX && Math.abs(resolved.x - other.x) <= ALIGN_SNAP_THRESHOLD) {
              resolved = { x: other.x, y: resolved.y };
              extraGuides.push({
                axis: 'x',
                position: other.x,
                start: Math.min(other.y, resolved.y),
                end: Math.max(other.y, resolved.y),
              });
            }
            if (!boxSnap.snappedY && Math.abs(resolved.y - other.y) <= ALIGN_SNAP_THRESHOLD) {
              resolved = { x: resolved.x, y: other.y };
              extraGuides.push({
                axis: 'y',
                position: other.y,
                start: Math.min(other.x, resolved.x),
                end: Math.max(other.x, resolved.x),
              });
            }
          }
          const boxGuides = guidesOn
            ? alignmentGuides(
                { x: resolved.x, y: resolved.y, width: 0, height: 0 },
                els0,
                NO_ALIGN_EXCLUDE,
              )
            : [];
          scheduleGuides(guidesOn ? [...boxGuides, ...extraGuides] : []);
        } else {
          scheduleGuides([]);
        }
        endpoint = { kind: 'free', x: resolved.x, y: resolved.y };
      }
      tick((els) =>
        els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        ),
      );
    };
    const onUp = (e: PointerEvent) => {
      const d = depsRef.current;
      // Quick-connect arrow "click to place": if the arrow was started by a
      // click (clickToPlace) and this release ends a gesture that never
      // really moved, don't commit — flip into `following` so the endpoint
      // trails the cursor and the NEXT click (handled in capture below)
      // places it. A real press-drag (moved past the threshold) falls
      // through and commits like any anchor drag.
      if (drag?.kind === 'arrow-endpoint' && drag.clickToPlace && !drag.following) {
        const px = drag.pressClientX ?? drag.startClientX;
        const py = drag.pressClientY ?? drag.startClientY;
        const moved = Math.hypot(e.clientX - px, e.clientY - py) > 6;
        if (!moved) {
          setDrag({ ...drag, clickToPlace: false, following: true });
          return;
        }
      }
      // Fold a dragged standalone icon shape into the shape it was
      // released over. Only on a real move (not a click), only when the
      // dragged element is a line-art 'icon' shape, and only when the
      // element directly beneath the cursor (skipping the dragged icon
      // itself) is a non-icon shape. Technology icons (spec/41) reuse the
      // 'icon' shape but are ALWAYS standalone — a coloured brand tile
      // folded beside a shape's text isn't meaningful and the inline-icon
      // renderer only knows line-art prims — so they're excluded here.
      if (drag?.kind === 'boxed' && drag.mode === 'move' && d.onIconElementDroppedOnShape) {
        const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > 4;
        const dragged = d.activeTab.elements.find((el) => el.id === drag.primaryId);
        if (
          moved &&
          dragged &&
          dragged.type === 'shape' &&
          dragged.shape === 'icon' &&
          !isTechIconId(dragged.iconId)
        ) {
          for (const node of document.elementsFromPoint(e.clientX, e.clientY)) {
            const host = node.closest('[data-element-id]');
            const id = host?.getAttribute('data-element-id');
            if (!id || id === drag.primaryId) continue;
            // First real element beneath the icon. Fold in only if it's a
            // shape that hosts inline icons (regular shapes — not an icon or
            // a frame); otherwise leave the icon as a plain move, so an icon
            // dropped on a frame lands inside it as a standalone element.
            const target = d.activeTab.elements.find((el) => el.id === id);
            if (target && acceptsInlineIcon(target) && host) {
              const rect = host.getBoundingClientRect();
              const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2 || 1);
              const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2 || 1);
              const position =
                Math.abs(dx) >= Math.abs(dy)
                  ? dx < 0
                    ? 'left'
                    : 'right'
                  : dy < 0
                    ? 'above'
                    : 'below';
              d.onIconElementDroppedOnShape(drag.primaryId, id, position);
            }
            break;
          }
        }
      }
      // Annotations open their note on DOUBLE-click now (handled in
      // BoxedElementView), so a plain click just selects — no note-open here.
      setDrag(null);
      scheduleGuides([]);
      // Disarm any checkpoint the gesture never used (a click that
      // selected without moving), so it can't attach to a later one.
      checkpointPendingRef.current = false;
      // Close the log gesture so the next drag starts clean. The
      // pending debounce timer (if any) still flushes the entry; this
      // only stops a later gesture from inheriting this one's "log it"
      // flag. (Cancelling the flush isn't wanted — that's the entry.)
      logGestureRef.current = false;
    };
    // Quick-connect arrow follow mode: the placing click. Captured on the
    // way DOWN (capture phase) so it commits the endpoint and is swallowed
    // before the canvas can read it as a marquee / deselect.
    const onPlaceClick = (e: PointerEvent) => {
      if (!(drag?.kind === 'arrow-endpoint' && drag.following)) return;
      e.preventDefault();
      e.stopPropagation();
      // The endpoint already tracks the cursor (last pointermove); this
      // click just lands it. Clear guides and end the gesture.
      setDrag(null);
      scheduleGuides([]);
    };
    // Escape cancels follow mode, removing the half-drawn arrow.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!(drag?.kind === 'arrow-endpoint' && drag.following)) return;
      const arrowId = drag.arrowId;
      depsRef.current.commit((els) => els.filter((el) => el.id !== arrowId));
      depsRef.current.setSelectedId(null);
      setDrag(null);
      scheduleGuides([]);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onSecondTouch);
    window.addEventListener('pointerdown', onPlaceClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onSecondTouch);
      window.removeEventListener('pointerdown', onPlaceClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag]);

  return {
    drag,
    snapGuides,
    distGuides,
    beginDrag,
    beginRotate,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    addCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  };
}
