import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import { snapResizeBounds, snapToAlignment, snapToArrowPoint } from '@livediagram/document';
import { ARROW_SNAP_THRESHOLD_PX, pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { StampPlacement } from '@/lib/stamp-placement';

const EMPTY_ID_SET: Set<string> = new Set();

const stampCentre = (p: StampPlacement) => ({
  x: p.bounds.x + p.bounds.width / 2,
  y: p.bounds.y + p.bounds.height / 2,
});

// The inputs the draw gesture reads, reusing CanvasProps' exact types so the
// hook can't drift from what Canvas passes.
type CanvasDrawGestureDeps = Pick<
  CanvasProps,
  | 'pendingDraw'
  | 'elements'
  | 'viewportZoom'
  | 'isPinchingRef'
  | 'onCommitDraw'
  | 'onCommitFreehand'
> & {
  wrapperRef: RefObject<HTMLDivElement | null>;
  // Set while the armed tile is a fixed-size note (useStampGhost): the gesture
  // then STAMPS the note at this placement instead of drawing a box to size.
  stampAt: ((canvasX: number, canvasY: number) => StampPlacement) | null;
  showStamp: (placement: StampPlacement | null) => void;
};

// Canvas draw-to-size + freehand pen gesture, lifted out of Canvas.tsx. Owns
// the in-progress draw state (box drag, pen polyline, pre-press snap hover)
// and the window-level pointer listeners that drive them, applying the same
// alignment / arrow snapping as a move/resize. Returns the live state for the
// preview overlay plus beginPendingDrawGesture, which the canvas pointer-down
// handlers call to start a gesture when an intent is armed.
export function useCanvasDrawGesture({
  pendingDraw,
  elements,
  wrapperRef,
  viewportZoom,
  isPinchingRef,
  onCommitDraw,
  onCommitFreehand,
  stampAt,
  showStamp,
}: CanvasDrawGestureDeps) {
  // Draw-to-size gesture state. Set when the user starts a drag on
  // the canvas while pendingDraw is set; cleared on pointer-up
  // (either when onCommitDraw persists the element or the drag was
  // cancelled). Coords are stored as canvas coords (pre-divided by
  // viewportZoom) so the preview renders in the same space as the
  // rest of the canvas content. `current` is the snapped point, not
  // the raw pointer, so preview + commit see the same number.
  const [drawDrag, setDrawDrag] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Pen gesture state. The freehand intent samples pointer positions
  // for the whole drag (one polyline) rather than start + end like
  // the box / line intents. Stored as a flat array of canvas-coord
  // points; appended to on every pointermove (throttled to one append
  // per frame via requestAnimationFrame so high-DPI / 120 Hz pointers
  // can't push thousands of samples per second through React's
  // reconciliation). Null when no pen drag is active.
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[] | null>(null);

  // Snap a draw gesture's START point to nearby element edge / centre
  // lines the same way the moving corner snaps: a 0×0 candidate snaps
  // each axis independently to the nearest line within the same
  // 6-screen-px halo, so a drawn shape's first corner — or an arrow's
  // first endpoint — can latch onto a neighbour instead of landing a
  // pixel off.
  const snapDrawStart = (px: number, py: number): { x: number; y: number } => {
    const snap = snapToAlignment(
      { x: px, y: py, width: 0, height: 0 },
      elements,
      EMPTY_ID_SET,
      6 / viewportZoom,
    );
    return { x: px + snap.dx, y: py + snap.dy };
  };

  // Starts a draw-to-size / freehand gesture from a primary-button
  // pointer-down when an intent is pending, converting to canvas
  // coords first. Returns true once a gesture began so callers can
  // stop there. Shared by the capture-phase intercept (which fires
  // over elements too) and the background bubble handlers; a freehand
  // intent seeds the polyline accumulator, every other intent seeds
  // the box / line drag.
  const beginPendingDrawGesture = (e: React.PointerEvent): boolean => {
    if (!pendingDraw) return false;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    if (pendingDraw.type === 'freehand') {
      // Snap the first stroke point to nearby alignments (same as a shape's
      // first corner) so the sketch can begin from an aligned start.
      const start = snapDrawStart(sx, sy);
      setPenPoints([{ x: start.x, y: start.y }]);
    } else if (stampAt) {
      // A stamp presses where its ghost is: start and end are both the
      // placed note's centre, so the commit reads it as a tap there.
      const placed = stampAt(sx, sy);
      const c = stampCentre(placed);
      showStamp(placed);
      setDrawDrag({ startX: c.x, startY: c.y, currentX: c.x, currentY: c.y });
    } else {
      const start = snapDrawStart(sx, sy);
      setDrawDrag({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });
    }
    return true;
  };

  // Pre-press snap preview: while a draw is armed but not yet started,
  // snap the hovered pointer to nearby element edges / centres and stash
  // it, so the user can land the shape's FIRST corner on an alignment
  // before pressing down (the moving corner already snaps mid-drag). Only
  // set when a snap is actually in effect, so the preview (a dot + guides
  // in CanvasChrome) appears exactly when the start would latch.
  const [drawHover, setDrawHover] = useState<{ x: number; y: number } | null>(null);
  // A stamp has its own ghost (useStampGhost); the corner-snap dot is for
  // shapes drawn to size. Out of that state, the dot goes at once.
  const hoverSnaps = !!pendingDraw && !drawDrag && !penPoints && !stampAt;
  if (!hoverSnaps && drawHover) setDrawHover(null);
  useEffect(() => {
    if (!hoverSnaps) return;
    const wrapperEl = wrapperRef.current;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      const { x: px, y: py } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
      const snap = snapToAlignment(
        { x: px, y: py, width: 0, height: 0 },
        elements,
        EMPTY_ID_SET,
        6 / viewportZoom,
      );
      setDrawHover(snap.dx === 0 && snap.dy === 0 ? null : { x: px + snap.dx, y: py + snap.dy });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [hoverSnaps, viewportZoom, elements, wrapperRef]);

  // Window-level move + up listeners for the draw gesture. Attached
  // only while a drag is in flight so the canvas pays nothing in the
  // common case (idle, or in pan / marquee mode). pointermove
  // resolves the raw pointer, applies snap (1:1 lock on shift, edge
  // alignment to existing elements via snapResizeBounds for box
  // intents), and stores the snapped point so the preview tracks it.
  // pointerup hands raw start + end to onCommitDraw and lets the
  // editor decide how to interpret them (box vs line). Pointercancel
  // + Escape go through the keyboard hook's onCancelDraw path.
  //
  // The listeners attach once per drag; what they do is an effect event,
  // so every move reads the zoom, elements, stamp and commit handler as
  // they are now rather than as they were at the press.
  type DrawDrag = { startX: number; startY: number; currentX: number; currentY: number };
  // One pointer move of the drag: the snapped next state, or null to leave it as it is.
  const nextDrawDrag = useEffectEvent((e: PointerEvent, latest: DrawDrag): DrawDrag | null => {
    if (!pendingDraw) return null;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // A 2-finger pinch took over: freeze the draw at its last good
    // position so finger-1's moves don't size the element to the
    // pinch-warped pointer (pan + editor-drag bail the same way).
    if (isPinchingRef?.current) return null;
    const isBoxIntent = pendingDraw.type !== 'arrow';
    // Snap threshold scales inversely with zoom so the "feel" is
    // consistent: a 6-screen-pixel halo at any zoom level, big enough
    // to grab edges without surprise-snapping while the user is
    // still freely placing.
    const snapPx = 6 / viewportZoom;
    const { x: rawX, y: rawY } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    if (stampAt) {
      // A stamp is carried, not sized: the ghost follows the pointer and the
      // drop is its centre.
      const placed = stampAt(rawX, rawY);
      const c = stampCentre(placed);
      showStamp(placed);
      return { startX: c.x, startY: c.y, currentX: c.x, currentY: c.y };
    }
    let endX = rawX;
    let endY = rawY;
    // 1:1 aspect lock on shift. Mirrors Figma / Photoshop: hold
    // shift while drawing to get a perfect square / circle. Picks
    // the dominant axis (the one the user moved further) and
    // matches the other to it, preserving the drag's direction so
    // the box still grows where the cursor is.
    if (e.shiftKey) {
      const dx = endX - latest.startX;
      const dy = endY - latest.startY;
      const absMax = Math.max(Math.abs(dx), Math.abs(dy));
      endX = latest.startX + (dx === 0 ? absMax : Math.sign(dx) * absMax);
      endY = latest.startY + (dy === 0 ? absMax : Math.sign(dy) * absMax);
    }
    // Element-edge snap for box intents. Arrows skip this: their
    // endpoints don't read as a bounding box (the natural snap
    // there is per-end anchor pinning, handled by the existing
    // arrow drag-handle flow after creation).
    if (isBoxIntent) {
      const x = Math.min(latest.startX, endX);
      const y = Math.min(latest.startY, endY);
      const width = Math.max(1, Math.abs(endX - latest.startX));
      const height = Math.max(1, Math.abs(endY - latest.startY));
      const mode: 'se' | 'sw' | 'ne' | 'nw' =
        endX >= latest.startX
          ? endY >= latest.startY
            ? 'se'
            : 'ne'
          : endY >= latest.startY
            ? 'sw'
            : 'nw';
      const snapped = snapResizeBounds(
        { x, y, width, height },
        mode,
        elements,
        EMPTY_ID_SET,
        snapPx,
        1,
      );
      endX = mode === 'se' || mode === 'ne' ? snapped.x + snapped.width : snapped.x;
      endY = mode === 'se' || mode === 'sw' ? snapped.y + snapped.height : snapped.y;
    } else {
      // Arrow: first try to latch the moving endpoint onto a nearby ARROW's
      // line (docs/specs/008-canvas/arrow-to-arrow.md), so drawing a message onto another arrow connects as
      // you draw (the dots render in CanvasChrome). That takes precedence
      // over the element edge/centre alignment snap below.
      const arrowHit = snapToArrowPoint(
        { x: endX, y: endY },
        elements,
        ARROW_SNAP_THRESHOLD_PX,
        '',
      );
      if (arrowHit) {
        endX = arrowHit.x;
        endY = arrowHit.y;
      } else {
        // Else snap to nearby element edge / centre lines (a point snap) so
        // it can latch onto a shape's edge or corner as you draw, the way
        // the box corner does. (Per-end anchor pinning still happens via the
        // arrow drag-handle flow after creation.)
        const snap = snapToAlignment(
          { x: endX, y: endY, width: 0, height: 0 },
          elements,
          EMPTY_ID_SET,
          snapPx,
        );
        endX += snap.dx;
        endY += snap.dy;
      }
    }
    return { ...latest, currentX: endX, currentY: endY };
  });
  const commitDrawDrag = useEffectEvent((snapshot: DrawDrag) => {
    if (!pendingDraw) return;
    onCommitDraw(
      pendingDraw,
      snapshot.startX,
      snapshot.startY,
      snapshot.currentX,
      snapshot.currentY,
    );
  });
  // The drag as the press left it: where the listeners start from.
  const drawDragAtPress = useEffectEvent(() => drawDrag);
  const dragging = drawDrag !== null;
  useEffect(() => {
    if (!dragging || !pendingDraw) return;
    // Local mutable mirror of drawDrag. The effect's setDrawDrag
    // updater used to call onCommitDraw inline, which re-entered
    // the editor's commit handler (a parent setState) from inside
    // React's setState updater path and tripped a "setState during
    // render" warning on LivePage. Keeping the latest gesture state
    // in a closure variable lets onMove update it synchronously and
    // onUp call onCommitDraw cleanly OUTSIDE any setState updater.
    // setDrawDrag is now only used to trigger preview re-renders.
    let latest: DrawDrag | null = drawDragAtPress();
    const onMove = (e: PointerEvent) => {
      if (!latest) return;
      const next = nextDrawDrag(e, latest);
      if (!next) return;
      latest = next;
      setDrawDrag(next);
    };
    const onUp = () => {
      const snapshot = latest;
      latest = null;
      setDrawDrag(null);
      if (snapshot) commitDrawDrag(snapshot);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, pendingDraw]);

  // Pen-gesture sampling loop. While penPoints is non-null and the
  // freehand intent is the active pendingDraw, accumulate pointer
  // samples into the polyline. Pointermove writes to a local mirror
  // and schedules ONE setPenPoints per requestAnimationFrame, so a
  // 120 Hz pointer doesn't pump thousands of React renders. On
  // pointerup we hand the polyline to onCommitFreehand (which
  // simplifies + smooths it) and clear the gesture state. As with the
  // drag, the listeners attach once per stroke and read the zoom and the
  // commit handler as they are now.
  const penSample = useEffectEvent((e: PointerEvent): { x: number; y: number } | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Stop sampling once a 2-finger pinch takes over, so the committed
    // polyline doesn't pick up the pinch-warped finger-1 path.
    if (isPinchingRef?.current) return null;
    return pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
  });
  const commitPenStroke = useEffectEvent((stroke: { x: number; y: number }[]) => {
    // Recognition is which PEN you picked, not a preference (docs/specs/008-canvas/two-pens.md):
    // the Shape Pen converts, plain Freehand and the highlighter never do.
    if (pendingDraw?.type !== 'freehand' || stroke.length < 2) return;
    onCommitFreehand(stroke, pendingDraw.variant === 'shape-pen');
  });
  // The stroke as the press left it: where the sampling starts from.
  const penAtPress = useEffectEvent(() => penPoints ?? []);
  const penning = penPoints !== null && pendingDraw?.type === 'freehand';
  useEffect(() => {
    if (!penning) return;
    let buffer = penAtPress();
    let rafId: number | null = null;
    const onMove = (e: PointerEvent) => {
      const point = penSample(e);
      if (!point) return;
      buffer = [...buffer, point];
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setPenPoints(buffer);
      });
    };
    const onUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      const snapshot = buffer;
      setPenPoints(null);
      commitPenStroke(snapshot);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [penning, pendingDraw]);

  return { drawDrag, penPoints, drawHover, beginPendingDrawGesture };
}
