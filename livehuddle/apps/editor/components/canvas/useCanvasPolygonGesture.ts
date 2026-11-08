import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { snap45 } from '@livehuddle/document';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

// Screen-space distance (px) within which a click on the FIRST corner
// closes the loop: corners are placed deliberately, so it is tight.
export const POLYGON_CLOSE_PX = 12;

// The Room Builder's click-to-place gesture (docs/specs/009-elements/room-builder.md), sibling to
// useCanvasDrawGesture. Owns the placed-corner accumulator, the live
// rubber-band cursor, and the finish keys (Enter / Backspace /
// Escape-with-corners). Canvas composes `beginPolygonPoint` in front
// of beginPendingDrawGesture so every pointer-down intercept point
// (capture-phase over elements + background bubble) feeds it; it
// claims the press only while the room-walls intent is armed. (The
// Polygon tool that shared it left with the element engine's part 4,
// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine".)
export function useCanvasPolygonGesture({
  pendingDraw,
  wrapperRef,
  viewportZoom,
  onCommitRoomWalls,
}: Pick<CanvasProps, 'pendingDraw' | 'onCommitRoomWalls'> & {
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

  // Corners snap to 45 degrees from the last (Cmd / Ctrl places freely, docs/specs/008-canvas/snap-override.md), and
  // every finish closes the room.
  const polygonArmed = pendingDraw?.type === 'room-walls';
  // Where a press at `raw` puts the next corner: 45 degrees from the last.
  const placeAt = (raw: { x: number; y: number }, free: boolean) => {
    const last = verticesRef.current[verticesRef.current.length - 1];
    return last && !free ? snap45(last, raw) : raw;
  };

  const resetGesture = () => {
    setPolygonVertices([]);
    setPolygonCursor(null);
  };

  // Commit helper. onCommitRoomWalls clears pendingDraw editor-side;
  // the armed-flag effect below then clears the local gesture state,
  // but reset eagerly too so the preview never flashes stale.
  const finishClosed = () => {
    const vertices = verticesRef.current;
    resetGesture();
    onCommitRoomWalls?.(vertices);
  };
  // A room is never open: its double-click and Enter close it (three corners or more).
  const finishOpen = () => {
    if (verticesRef.current.length >= 3) finishClosed();
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
    // A corner after the first runs at 45 degrees from the last.
    setPolygonVertices([...vertices, placeAt(raw, e.metaKey || e.ctrlKey)]);
    return true;
  };

  // Double-click closes the room. Returns true when consumed so Canvas skips the add-text
  // double-click path.
  const handlePolygonDoubleClick = (): boolean => {
    if (!polygonArmed) return false;
    finishOpen();
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
      latest = last && !(e.metaKey || e.ctrlKey) ? snap45(last, raw) : raw;
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
  }, [polygonArmed, hasVertices, viewportZoom, wrapperRef, verticesRef]);

  // Finish / edit keys, capture-phase so they win over the editor's
  // own keydown handlers while a room is in flight:
  // - Enter closes the room.
  // - Backspace / Delete removes the last placed vertex.
  // - Escape with vertices clears them but STAYS armed (the second
  //   Escape falls through to the editor's cancelDraw and disarms).
  //
  // The handler is an effect event, so it reads the newest vertices and
  // commit handler while the listener stays attached for the whole gesture.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const vertices = verticesRef.current;
    if (e.key === 'Enter' && vertices.length >= 3) {
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
