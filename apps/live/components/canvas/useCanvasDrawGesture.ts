import { useEffect, useState, type RefObject } from 'react';
import { snapResizeBounds, snapToAlignment, snapToArrowPoint } from '@livediagram/diagram';
import { ARROW_SNAP_THRESHOLD_PX, pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

const EMPTY_ID_SET: Set<string> = new Set();

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
> & { wrapperRef: RefObject<HTMLDivElement | null> };

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
  useEffect(() => {
    if (!pendingDraw || drawDrag || penPoints) {
      setDrawHover(null);
      return;
    }
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
  }, [pendingDraw, drawDrag, penPoints, viewportZoom, elements, wrapperRef]);

  // Window-level move + up listeners for the draw gesture. Attached
  // only while a drag is in flight so the canvas pays nothing in the
  // common case (idle, or in pan / marquee mode). pointermove
  // resolves the raw pointer, applies snap (1:1 lock on shift, edge
  // alignment to existing elements via snapResizeBounds for box
  // intents), and stores the snapped point so the preview tracks it.
  // pointerup hands raw start + end to onCommitDraw and lets the
  // editor decide how to interpret them (box vs line). Pointercancel
  // + Escape go through the keyboard hook's onCancelDraw path.
  useEffect(() => {
    if (!drawDrag || !pendingDraw) return;
    const wrapperEl = wrapperRef.current;
    const isBoxIntent = pendingDraw.type !== 'arrow';
    // Snap threshold scales inversely with zoom so the "feel" is
    // consistent: a 6-screen-pixel halo at any zoom level, big enough
    // to grab edges without surprise-snapping while the user is
    // still freely placing.
    const snapPx = 6 / viewportZoom;
    // Local mutable mirror of drawDrag. The effect's setDrawDrag
    // updater used to call onCommitDraw inline, which re-entered
    // the editor's commit handler (a parent setState) from inside
    // React's setState updater path and tripped a "setState during
    // render" warning on LivePage. Keeping the latest gesture state
    // in a closure variable lets onMove update it synchronously and
    // onUp call onCommitDraw cleanly OUTSIDE any setState updater.
    // setDrawDrag is now only used to trigger preview re-renders.
    let latest: { startX: number; startY: number; currentX: number; currentY: number } | null =
      drawDrag;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect || !latest) return;
      // A 2-finger pinch took over: freeze the draw at its last good
      // position so finger-1's moves don't size the element to the
      // pinch-warped pointer (pan + editor-drag bail the same way).
      if (isPinchingRef?.current) return;
      const { x: rawX, y: rawY } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
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
        // line (spec/50), so drawing a message onto another arrow connects as
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
      latest = { ...latest, currentX: endX, currentY: endY };
      setDrawDrag(latest);
    };
    const onUp = () => {
      const snapshot = latest;
      latest = null;
      setDrawDrag(null);
      if (snapshot) {
        onCommitDraw(
          pendingDraw,
          snapshot.startX,
          snapshot.startY,
          snapshot.currentX,
          snapshot.currentY,
        );
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDrag !== null, pendingDraw]);

  // Pen-gesture sampling loop. While penPoints is non-null and the
  // freehand intent is the active pendingDraw, accumulate pointer
  // samples into the polyline. Pointermove writes to a local mirror
  // and schedules ONE setPenPoints per requestAnimationFrame, so a
  // 120 Hz pointer doesn't pump thousands of React renders. On
  // pointerup we hand the polyline to onCommitFreehand (which
  // simplifies + smooths it) and clear the gesture state.
  useEffect(() => {
    if (!penPoints || !pendingDraw || pendingDraw.type !== 'freehand') return;
    const wrapperEl = wrapperRef.current;
    let buffer: { x: number; y: number }[] = penPoints;
    let rafId: number | null = null;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      // Stop sampling once a 2-finger pinch takes over, so the committed
      // polyline doesn't pick up the pinch-warped finger-1 path.
      if (isPinchingRef?.current) return;
      const { x, y } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
      buffer = [...buffer, { x, y }];
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
      if (snapshot.length >= 2) {
        // Recognition is which PEN you picked, not a preference (spec/112):
        // the Shape Pen converts, plain Freehand and the highlighter never do.
        onCommitFreehand(snapshot, pendingDraw?.variant === 'shape-pen');
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penPoints !== null, pendingDraw]);

  return { drawDrag, penPoints, drawHover, beginPendingDrawGesture };
}
