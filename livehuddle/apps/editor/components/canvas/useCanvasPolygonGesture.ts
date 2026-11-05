import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { snap45, snapToAlignment } from '@livehuddle/document';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

const EMPTY_ID_SET: Set<string> = new Set();

// Screen-space distance (px) within which a click on the FIRST vertex
// closes the loop. Matches the freehand auto-close feel (16 canvas px
// at zoom 1) but slightly tighter since polygon clicks are deliberate.
export const POLYGON_CLOSE_PX = 12;

// The polygon tool's click-to-place gesture (docs/specs/008-canvas/polygon-tool.md), sibling to
// useCanvasDrawGesture. Owns the placed-vertex accumulator, the live
// rubber-band cursor, and the finish keys (Enter / Backspace /
// Escape-with-vertices). Canvas composes `beginPolygonPoint` in front
// of beginPendingDrawGesture so every pointer-down intercept point
// (capture-phase over elements + background bubble) feeds it; it
// claims the press only while the polygon intent is armed.
export function useCanvasPolygonGesture({
  pendingDraw,
  elements,
  wrapperRef,
  viewportZoom,
  onCommitPolygon,
  onCommitRoomWalls,
}: Pick<CanvasProps, 'pendingDraw' | 'elements' | 'onCommitPolygon' | 'onCommitRoomWalls'> & {
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
}) {
  const [polygonVertices, setVerticesState] = useState<{ x: number; y: number }[]>([]);
  // Live pointer position (canvas coords) for the rubber-band preview
  // segment. Null until the pointer moves after the first vertex.
  const [polygonCursor, setPolygonCursor] = useState<{ x: number; y: number } | null>(null);
  // The corners as placed, written in the same call that sets the state rather than after the render commits: two
  // clicks inside one frame used to build on the same stale list, dropping a corner (and a room closed on what was
  // left could be refused and cleared). The press, the keys and the rubber band all read this.
  const verticesRef = useRef<{ x: number; y: number }[]>([]);
  const setPolygonVertices = (next: { x: number; y: number }[]) => {
    verticesRef.current = next;
    setVerticesState(next);
  };

  // The Room Builder (docs/specs/009-elements/room-builder.md) is the same gesture: corners snapped to 45 degrees from
  // the last (Cmd / Ctrl places freely, docs/specs/008-canvas/snap-override.md), and every finish closes the room.
  const roomMode = pendingDraw?.type === 'room-walls';
  const polygonArmed = pendingDraw?.type === 'polygon' || roomMode;
  // Where a press at `raw` puts the next corner: 45 degrees from the last in room mode.
  const placeAt = (raw: { x: number; y: number }, free: boolean) => {
    const last = verticesRef.current[verticesRef.current.length - 1];
    return roomMode && last && !free ? snap45(last, raw) : raw;
  };

  const resetGesture = () => {
    setPolygonVertices([]);
    setPolygonCursor(null);
  };

  // Commit helpers. onCommitPolygon clears pendingDraw editor-side;
  // the armed-flag effect below then clears the local gesture state,
  // but reset eagerly too so the preview never flashes stale.
  const finishClosed = () => {
    const vertices = verticesRef.current;
    resetGesture();
    if (roomMode) onCommitRoomWalls?.(vertices);
    else onCommitPolygon(vertices, true);
  };
  // A room is never open: its double-click and Enter close it (three corners or more).
  const finishOpen = () => {
    if (roomMode) {
      if (verticesRef.current.length >= 3) finishClosed();
      return;
    }
    const vertices = verticesRef.current;
    resetGesture();
    onCommitPolygon(vertices, false);
  };

  // A primary-button press while the polygon intent is armed places a
  // vertex (or closes the loop on the start vertex). Returns true when
  // it claimed the press so callers stop there, mirroring
  // beginPendingDrawGesture's contract.
  const beginPolygonPoint = (e: React.PointerEvent): boolean => {
    if (!polygonArmed) return false;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const raw = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    const vertices = verticesRef.current;
    // Close the loop: a click near the FIRST vertex with enough points
    // for a real polygon commits closed (the click adds no vertex).
    if (vertices.length >= 3) {
      const first = vertices[0]!;
      if (Math.hypot(raw.x - first.x, raw.y - first.y) <= POLYGON_CLOSE_PX / viewportZoom) {
        finishClosed();
        return true;
      }
    }
    // Swallow the double-click's second pointer-down (it lands on the
    // last vertex): the dblclick handler finishes the line, and a
    // duplicate vertex would kink the committed path.
    const last = vertices[vertices.length - 1];
    if (last && Math.hypot(raw.x - last.x, raw.y - last.y) <= 2 / viewportZoom) {
      return true;
    }
    // A room's corner after the first runs at 45 degrees from the last.
    if (roomMode && last) {
      setPolygonVertices([...vertices, placeAt(raw, e.metaKey || e.ctrlKey)]);
      return true;
    }
    // Same alignment snap as a draw gesture's start point, so vertices
    // can latch onto neighbouring element edges / centres.
    const snap = snapToAlignment(
      { x: raw.x, y: raw.y, width: 0, height: 0 },
      elements,
      EMPTY_ID_SET,
      6 / viewportZoom,
    );
    setPolygonVertices([...vertices, { x: raw.x + snap.dx, y: raw.y + snap.dy }]);
    return true;
  };

  // Double-click finishes the open polyline (docs/specs/008-canvas/polygon-tool.md). Returns true
  // when consumed so Canvas skips the add-text double-click path.
  const handlePolygonDoubleClick = (): boolean => {
    if (!polygonArmed) return false;
    if (verticesRef.current.length >= (roomMode ? 3 : 2)) finishOpen();
    return true;
  };

  // Clear the gesture whenever the intent disarms (commit, Escape via
  // the editor's cancelDraw, or a tool switch).
  if (!polygonArmed && (polygonVertices.length > 0 || polygonCursor)) {
    setVerticesState([]);
    setPolygonCursor(null);
  }
  useEffect(() => {
    if (!polygonArmed) verticesRef.current = [];
  }, [polygonArmed]);

  // Rubber-band tracking: while armed with at least one vertex, follow
  // the pointer (rAF-throttled) so the preview segment tracks the
  // cursor without pumping a render per pointermove.
  const hasVertices = polygonVertices.length > 0;
  useEffect(() => {
    if (!polygonArmed || !hasVertices) return;
    const wrapperEl = wrapperRef.current;
    let rafId: number | null = null;
    let latest: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      const raw = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
      const last = verticesRef.current[verticesRef.current.length - 1];
      latest = roomMode && last && !(e.metaKey || e.ctrlKey) ? snap45(last, raw) : raw;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setPolygonCursor(latest);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [polygonArmed, roomMode, hasVertices, viewportZoom, wrapperRef, verticesRef]);

  // Finish / edit keys, capture-phase so they win over the editor's
  // own keydown handlers while a polygon is in flight:
  // - Enter commits the open polyline.
  // - Backspace / Delete removes the last placed vertex.
  // - Escape with vertices clears them but STAYS armed (the second
  //   Escape falls through to the editor's cancelDraw and disarms).
  //
  // The handler is an effect event, so it reads the newest vertices and
  // commit handler while the listener stays attached for the whole gesture.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const vertices = verticesRef.current;
    if (e.key === 'Enter' && vertices.length >= (roomMode ? 3 : 2)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      finishOpen();
      return;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && vertices.length > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setPolygonVertices(vertices.slice(0, -1));
      return;
    }
    if (e.key === 'Escape' && vertices.length > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      resetGesture();
    }
  });
  useEffect(() => {
    if (!polygonArmed) return;
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, [polygonArmed]);

  return { polygonVertices, polygonCursor, beginPolygonPoint, handlePolygonDoubleClick };
}
