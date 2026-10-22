import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import { snapResizeBounds, snapToAlignment, snapToArrowPoint } from '@livepages/document';
import { ARROW_SNAP_THRESHOLD_PX, pointerToCanvas, snapLeadingAxis } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { beginCanvasGesture } from '@/lib/canvas-gesture';

const EMPTY_ID_SET: Set<string> = new Set();

// The inputs the draw gesture reads, reusing CanvasProps' exact types so the
// hook can't drift from what Canvas passes.
type CanvasDrawGestureDeps = Pick<
  CanvasProps,
  'pendingDraw' | 'elements' | 'isPinchingRef' | 'onCommitDraw'
> & {
  // The zoom now (CanvasView reads it from the viewport store).
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// Canvas draw-to-size gesture, lifted out of Canvas.tsx. Owns
// the in-progress draw state (box drag, pre-press snap hover)
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

  // Drawing is a stroke gesture (docs/specs/008-canvas/canvas-performance.md), press to release.
  const drawing = drawDrag !== null;
  useEffect(() => (drawing ? beginCanvasGesture('stroke') : undefined), [drawing]);

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

  // Starts a draw-to-size gesture from a primary-button
  // pointer-down when an intent is pending, converting to canvas
  // coords first. Returns true once a gesture began so callers can
  // stop there. Shared by the capture-phase intercept (which fires
  // over elements too) and the background bubble handlers; every
  // intent seeds the box / line drag.
  const beginPendingDrawGesture = (e: React.PointerEvent): boolean => {
    if (!pendingDraw) return false;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    const start = snapDrawStart(sx, sy);
    setDrawDrag({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });
    return true;
  };

  // Pre-press snap preview: while a draw is armed but not yet started,
  // snap the hovered pointer to nearby element edges / centres and stash
  // it, so the user can land the shape's FIRST corner on an alignment
  // before pressing down (the moving corner already snaps mid-drag). Only
  // set when a snap is actually in effect, so the preview (a dot + guides
  // in CanvasChrome) appears exactly when the start would latch.
  const [drawHover, setDrawHover] = useState<{ x: number; y: number } | null>(null);
  // The corner-snap dot is for shapes drawn to size. Out of that state, the dot goes at once.
  const hoverSnaps = !!pendingDraw && !drawDrag;
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
  // so every move reads the zoom, elements and commit handler as
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
    let endX = rawX;
    let endY = rawY;
    // 1:1 aspect lock on shift. Mirrors Figma / Photoshop: hold
    // shift while drawing to get a perfect square / circle. Picks
    // the dominant axis (the one the user moved further) and
    // matches the other to it, preserving the drag's direction so
    // the box still grows where the cursor is. Read on every move, so
    // pressing or releasing Shift mid-drag lands on the next one.
    const square = e.shiftKey;
    const lead: 'x' | 'y' =
      Math.abs(rawX - latest.startX) >= Math.abs(rawY - latest.startY) ? 'x' : 'y';
    if (square) {
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
      // Square: the snap applies on the leading axis only and the other
      // side follows, so it stays square (docs/specs/008-canvas/canvas-and-palette.md
      // "Resize"). Free: each moving edge snaps on its own.
      const snapped = square
        ? snapLeadingAxis({ x, y, width, height }, mode, lead, (c, edge) =>
            snapResizeBounds(c, edge, elements, EMPTY_ID_SET, snapPx, 1),
          )
        : snapResizeBounds({ x, y, width, height }, mode, elements, EMPTY_ID_SET, snapPx, 1);
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

  return { drawDrag, drawHover, beginPendingDrawGesture };
}
