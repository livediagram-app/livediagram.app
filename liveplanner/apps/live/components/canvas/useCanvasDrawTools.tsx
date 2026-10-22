'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';

type CanvasDrawToolsInput = {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
} & Pick<
  CanvasProps,
  'pendingDraw' | 'elements' | 'isPinchingRef' | 'onCommitDraw' | 'onCommitPolygon'
>;

// The canvas's drawing gestures, composed in their order of precedence: a polygon's click-to-place
// (docs/specs/008-canvas/polygon-tool.md), then the draw-to-size of an armed tile.
export function useCanvasDrawTools({
  pendingDraw,
  elements,
  viewportZoom,
  wrapperRef,
  isPinchingRef,
  onCommitDraw,
  onCommitPolygon,
}: CanvasDrawToolsInput) {
  const { drawDrag, drawHover, beginPendingDrawGesture } = useCanvasDrawGesture({
    pendingDraw,
    elements,
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    onCommitDraw,
  });

  // Polygon click-to-place gesture (docs/specs/008-canvas/polygon-tool.md), composed IN FRONT of the
  // drag-based draw gesture: while the polygon intent is armed it
  // claims every draw-intercept press as a vertex placement.
  const { polygonVertices, polygonCursor, beginPolygonPoint, handlePolygonDoubleClick } =
    useCanvasPolygonGesture({
      pendingDraw,
      elements,
      wrapperRef,
      viewportZoom,
      onCommitPolygon,
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
