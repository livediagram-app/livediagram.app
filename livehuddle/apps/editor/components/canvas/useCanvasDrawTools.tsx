'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';
import { usePathTool } from '@/components/canvas/path/usePathTool';
import { useFillPress } from '@liveworkspace/workbench/hooks/canvas/useFillPress';
import { isFillIntent } from '@/lib/draw-mode';

type CanvasDrawToolsInput = {
  props: CanvasProps;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  soleSelectedPathId: string | null;
} & Pick<
  CanvasProps,
  | 'pendingDraw'
  | 'elements'
  | 'canvasTool'
  | 'isPinchingRef'
  | 'onCommitDraw'
  | 'onCommitFreehand'
  | 'onCommitPolygon'
  | 'editingId'
  | 'onDeselect'
>;

// The canvas's drawing gestures, composed in their order of precedence: the Path tool
// (docs/specs/023-draw-mode/path-tool.md), then a polygon's click-to-place (docs/specs/008-canvas/polygon-tool.md), then
// the draw-to-size of an armed tile.
export function useCanvasDrawTools({
  props,
  pendingDraw,
  elements,
  canvasTool,
  viewportZoom,
  wrapperRef,
  isPinchingRef,
  onCommitDraw,
  onCommitFreehand,
  onCommitPolygon,
  editingId,
  soleSelectedPathId,
  onDeselect,
}: CanvasDrawToolsInput) {
  const { drawDrag, penPoints, penStroke, drawHover, beginPendingDrawGesture } =
    useCanvasDrawGesture({
      pendingDraw,
      elements,
      wrapperRef,
      viewportZoom,
      isPinchingRef,
      onCommitDraw,
      onCommitFreehand,
      whiteboard: false,
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
      onCommitRoomWalls: props.onCommitRoomWalls,
    });
  // The Path tool (docs/specs/023-draw-mode/path-tool.md), in front of both: see usePathTool.
  const pathTool = usePathTool({
    pendingDraw,
    canvasTool,
    elements,
    wrapperRef,
    viewportZoom,
    activeTabId: props.activeTabId,
    editingId,
    soleSelectedPathId,
    onCommitPath: props.onCommitPath,
    onCommitPathEdit: props.onCommitPathEdit,
    onDressPath: props.onDressPath,
    onLeaveEdit: props.onCancelEdit,
    onDeselect,
    onBeginEdit: props.onBeginEdit,
    onCancelDraw: props.onCancelDraw,
  });
  // The Fill tool (docs/specs/023-draw-mode/fill-tool.md), in front of every drawing gesture: while it
  // is in hand a press is a fill, never a draw.
  const { beginFillPress } = useFillPress({
    armed: isFillIntent(pendingDraw),
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    onPaintBucket: props.onPaintBucket,
  });
  const beginPendingDrawOrPolygon = (e: React.PointerEvent): boolean =>
    beginFillPress(e) ||
    pathTool.beginPathPress(e) ||
    beginPolygonPoint(e) ||
    beginPendingDrawGesture(e);
  return {
    drawDrag,
    penPoints,
    penStroke,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    pathTool,
    beginPendingDrawOrPolygon,
  };
}
