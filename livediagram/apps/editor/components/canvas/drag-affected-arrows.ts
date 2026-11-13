// Which arrows a drag preview must redraw, and how (docs/specs/008-canvas/drag-preview.md "The preview"): the
// workbench's grid-backed arrow work (@liveworkspace/workbench/lib/drag-affected-arrows), bound to this document's
// element model. Linear in what moved per frame (docs/specs/008-canvas/canvas-performance.md).

import {
  buildElementGrid,
  buildElementIndex,
  elementIndexFor,
  endpointPosition,
  isBoxed,
  isDefaultMindConnectorLook,
  queryElementGrid,
  resolveFinish,
  routeBehindHoles,
  routeBehindQueryRect,
  type ArrowElement,
  type Element,
  type ElementGrid,
  type ElementIndex,
} from '@livediagram/document';
import { createDragAffectedArrows } from '@liveworkspace/workbench/lib/drag-affected-arrows';
import { createArrowGeometryCache } from '@liveworkspace/workbench/lib/arrow-geometry-cache';
import {
  deriveArrowViewFrame,
  type ArrowViewFrame,
  type arrowViewGeometry,
} from './arrow-view-frame';

export type { ArrowLinks } from '@liveworkspace/workbench/lib/drag-affected-arrows';

export const { buildArrowLinks, affectedArrows, movedBoxesGrid, previewArrowGeometry } =
  createDragAffectedArrows<Element, ArrowElement, ElementIndex, ElementGrid, ArrowViewFrame>({
    isBoxed,
    isArrow: (el): el is ArrowElement => el.type === 'arrow',
    ends: (arrow) => [arrow.from, arrow.to],
    buildElementIndex: (elements) => buildElementIndex(elements as Element[]),
    elementIndexFor,
    endpointPosition: (end, index) => endpointPosition(end as ArrowElement['from'], index),
    routeBehindQueryRect,
    routeBehindHoles,
    buildElementGrid,
    queryElementGrid,
    frameOf: (arrow, index, tabFinish) =>
      deriveArrowViewFrame(arrow, index, resolveFinish(arrow.finish, tabFinish)),
  });

// A mind map's connector: a finish may route it from the map's shape (mind-connector-route.ts), so what it draws reads
// more than its neighbours.
export const mindRoutable = (el: Element): boolean =>
  el.type === 'arrow' &&
  el.from.kind === 'pinned' &&
  el.to.kind === 'pinned' &&
  isDefaultMindConnectorLook(el);

// The element layer's arrow geometry, carried over for the arrows a change cannot reach (canvas-performance.md "A drop
// redraws what it reached"). One per layer.
export const arrowGeometryCache = () =>
  createArrowGeometryCache<Element, ReturnType<typeof arrowViewGeometry>>({
    isArrow: (el) => el.type === 'arrow',
    ends: (arrow) => [(arrow as ArrowElement).from, (arrow as ArrowElement).to],
    reach: ({ frame }) => routeBehindQueryRect(frame.from, frame.to),
    structural: mindRoutable,
  });
