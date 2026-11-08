'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';

type CanvasDrawToolsInput = {
  props: CanvasProps;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
} & Pick<CanvasProps, 'pendingDraw' | 'elements' | 'isPinchingRef' | 'onCommitDraw'>;

// The canvas's drawing gestures, composed in their order of precedence: the Room Builder's
// click-to-place corners (docs/specs/009-elements/room-builder.md), then the draw-to-size of an armed
// tile. (The Path and Fill tools and the Polygon left with the element engine's part 4,
// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine".)
export function useCanvasDrawTools({
  props,
  pendingDraw,
  elements,
  viewportZoom,
  wrapperRef,
  isPinchingRef,
  onCommitDraw,
}: CanvasDrawToolsInput) {
  const { drawDrag, drawHover, beginPendingDrawGesture } = useCanvasDrawGesture({
    pendingDraw,
    elements,
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    onCommitDraw,
  });

  // The Room Builder's click-to-place gesture, composed IN FRONT of the drag-based draw gesture:
  // while room-walls is armed it claims every draw-intercept press as a corner placement.
  const { polygonVertices, polygonCursor, beginPolygonPoint, handlePolygonDoubleClick } =
    useCanvasPolygonGesture({
      pendingDraw,
      wrapperRef,
      viewportZoom,
      onCommitRoomWalls: props.onCommitRoomWalls,
    });
  const beginPendingDrawOrPolygon = (e: React.PointerEvent): boolean =>
    beginPolygonPoint(e) || beginPendingDrawGesture(e);
  return {
    drawDrag,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    beginPendingDrawOrPolygon,
  };
}
