'use client';

import { useMemo, type RefObject } from 'react';
import {
  continuedPath,
  defaultFillColor,
  defaultStrokeColor,
  inkWhiteboardElement,
  pathGeometry,
  type Element,
  type PathElement,
} from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { rubberBand } from '@/lib/path-draw';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePathDrawGesture, type PathCommit } from './usePathDrawGesture';
import type { PathDraftView } from './PathDraftLayer';

// The id the path being drawn renders under: it has no element yet.
export const PATH_DRAFT_ID = 'path-draft';

const identity = <T>(el: T): T => el;

// The Path tool on the canvas (docs/specs/023-whiteboard/path-tool.md): composes the drawing
// gesture for Canvas, which wires in three things with the smallest edit to itself: the press
// intercept, the elements it shows (a path being continued is drawn by the draft instead), and the
// layer that draws the draft in the transformed canvas.
export function usePathTool({
  pendingDraw,
  elements,
  inertIds,
  wrapperRef,
  viewportZoom,
  activeTabId,
  whiteboardInk,
  onCommitPath,
  onDressPath = identity,
}: {
  pendingDraw: PendingDraw | null;
  elements: Element[];
  inertIds?: ReadonlySet<string>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  activeTabId?: string;
  // The board's ink on a whiteboard (undefined elsewhere): an unpainted path draws in it.
  whiteboardInk?: string;
  onCommitPath: (commit: PathCommit) => void;
  onDressPath?: <T extends Element>(el: T) => T;
}) {
  const surface = useCanvasSurface();
  const draw = usePathDrawGesture({
    pendingDraw,
    elements,
    inertIds,
    wrapperRef,
    viewportZoom,
    activeTabId,
    onCommitPath,
  });
  const { draft } = draw;
  const continuingId = draft?.continuing?.id ?? null;

  // The path as it will land, displayed as the canvas displays that element (from its first node,
  // so the rubber band wears its style too; the layer draws the path once it has two).
  const element = useMemo((): PathElement | null => {
    if (!draft || draft.anchors.length === 0) return null;
    const original = continuingId ? elements.find((el) => el.id === continuingId) : undefined;
    const base =
      original?.type === 'path'
        ? continuedPath(original, draft.anchors, false)
        : onDressPath<PathElement>({
            id: PATH_DRAFT_ID,
            type: 'path',
            ...pathGeometry(draft.anchors, false),
            closed: false,
          });
    return whiteboardInk ? inkWhiteboardElement(base, whiteboardInk) : base;
  }, [draft, continuingId, elements, onDressPath, whiteboardInk]);

  const shownElements = useMemo(
    () => (continuingId ? elements.filter((el) => el.id !== continuingId) : elements),
    [elements, continuingId],
  );

  const view: PathDraftView | null =
    draft && element
      ? {
          element,
          stroke: element.strokeColor ?? defaultStrokeColor(element, surface),
          fill: element.fillColor ?? defaultFillColor(element, surface),
          anchors: draft.anchors,
          active: draw.dragIndex ?? draft.anchors.length - 1,
          band:
            draw.dragIndex === null && draw.cursor
              ? rubberBand(draft, draw.cursor, draw.shift)
              : null,
          ring: draw.ring,
          zoom: viewportZoom,
        }
      : draw.ring
        ? {
            element: null,
            stroke: 'transparent',
            fill: 'transparent',
            anchors: [],
            active: null,
            band: null,
            ring: draw.ring,
            zoom: viewportZoom,
          }
        : null;

  return {
    beginPathPress: draw.beginPathPress,
    handlePathDoubleClick: draw.handlePathDoubleClick,
    elements: shownElements,
    draftView: view,
  };
}
