'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useStampGhost } from '@/components/canvas/useStampGhost';
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
// the draw-to-size or stamp of an armed tile (docs/specs/021-event-storming/event-storming.md Phase 4).
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
  const { drawDrag, penPoints, penStroke, drawHover, beginPendingDrawGesture } =
    useCanvasDrawGesture({
      pendingDraw,
      elements,
      wrapperRef,
      viewportZoom,
      isPinchingRef,
      onCommitDraw,
      onCommitFreehand,
      stampAt,
      showStamp,
      whiteboard: props.editorMode === 'draw',
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
  // The Path tool (docs/specs/023-draw-mode/path-tool.md), in front of both: see usePathTool.
  const pathTool = usePathTool({
    pendingDraw,
    canvasTool,
    elements,
    inertIds: props.layerInertIds,
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
    stamp,
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
