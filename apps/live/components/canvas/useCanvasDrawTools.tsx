'use client';

import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useStampGhost } from '@/components/canvas/useStampGhost';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';
import { pageIdAtPress, pressIsOffPage } from '@/hooks/canvas/page-guard';

type CanvasDrawToolsInput = {
  props: CanvasProps;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportZoom: number;
} & Pick<
  CanvasProps,
  'pendingDraw' | 'elements' | 'canvasTool' | 'isPinchingRef' | 'onCommitDraw' | 'onCommitPolygon'
>;

// The canvas's drawing gestures, composed in their order of precedence: a polygon's click-to-place
// (docs/specs/008-canvas/polygon-tool.md), then
// the draw-to-size or stamp of an armed tile (docs/specs/021-event-storming/event-storming.md Phase 4), with
// Pages mode's off-page presses and the Format tool's page press ahead of them all.
export function useCanvasDrawTools({
  props,
  pendingDraw,
  elements,
  canvasTool,
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
  // The Format tool's press on a page's paper arms or paints its background (docs/specs/007-editor/
  // pages-mode.md "Copying a background"); off every page it stays an empty-canvas press.
  const formatPagePress = (e: React.PointerEvent): boolean => {
    if (canvasTool !== 'format' || e.button !== 0 || !props.onFormatPagePress) return false;
    // On an element, the press is the element's (arming or painting its look): only the paper is the page's.
    if ((e.target as HTMLElement | null)?.closest?.('[data-element-id]')) return false;
    const pageId = pageIdAtPress(props.pagesMode, e, wrapperRef, viewportZoom);
    if (!pageId) return false;
    props.onFormatPagePress(pageId);
    return true;
  };
  // In Pages mode a press off the page is claimed and dropped: nothing is made there.
  const offPage = (e: { clientX: number; clientY: number }) =>
    pressIsOffPage(props.pagesMode, e, wrapperRef, viewportZoom);
  const beginPendingDrawOrPolygon = (e: React.PointerEvent): boolean =>
    offPage(e) || beginPolygonPoint(e) || beginPendingDrawGesture(e);
  return {
    stamp,
    drawDrag,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    formatPagePress,
    offPage,
    beginPendingDrawOrPolygon,
  };
}
