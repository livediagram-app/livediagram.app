'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useStampGhost } from '@/components/canvas/useStampGhost';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';

type CanvasDrawToolsInput = {
  props: CanvasProps;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
} & Pick<
  CanvasProps,
  'pendingDraw' | 'elements' | 'isPinchingRef' | 'onCommitDraw' | 'onCommitPolygon'
>;

// The canvas's drawing gestures, composed in their order of precedence: a polygon's click-to-place
// (docs/specs/008-canvas/polygon-tool.md), then the draw-to-size or stamp of an armed tile
// (docs/specs/021-event-storming/event-storming.md Phase 4).
export function useCanvasDrawTools({
  props,
  pendingDraw,
  elements,
  viewportZoom,
  wrapperRef,
  isPinchingRef,
  onCommitDraw,
  onCommitPolygon,
}: CanvasDrawToolsInput) {
  // An armed workshop-note tile is a STAMP, not a draw-to-size (docs/specs/021-event-storming/event-storming.md
  // Phase 4): its ghost follows the pointer, and the draw gesture places by the
  // same rule.
  const { stamp, stampAt, showStamp } = useStampGhost({
    pendingDraw,
    elements,
    tabKind: props.tabKind,
    tabLayers: props.tabLayers,
    viewportZoom,
    wrapperRef,
  });
  const { drawDrag, drawHover, beginPendingDrawGesture } = useCanvasDrawGesture({
    pendingDraw,
    elements,
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    onCommitDraw,
    stampAt,
    showStamp,
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
    stamp,
    drawDrag,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    beginPendingDrawOrPolygon,
  };
}
