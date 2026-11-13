// Which arrows a drag preview must redraw, and how (docs/specs/008-canvas/drag-preview.md "The preview"): the
// workbench's grid-backed arrow work (@liveworkspace/workbench/lib/drag-affected-arrows), bound to this design's
// element model. Linear in what moved per frame (docs/specs/008-canvas/canvas-performance.md).

import {
  buildElementGrid,
  buildElementIndex,
  elementIndexFor,
  endpointPosition,
  isBoxed,
  queryElementGrid,
  routeBehindHoles,
  routeBehindQueryRect,
  type ArrowElement,
  type Element,
  type ElementGrid,
  type ElementIndex,
} from '@livedesign/design';
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
    frameOf: (arrow, index) => deriveArrowViewFrame(arrow, index),
  });

// The element layer's arrow geometry, carried over for the arrows a change cannot reach (canvas-performance.md "A drop
// redraws what it reached"). One per layer. Nothing here is structural: the layer's frame reads the arrow's pins, their
// fans and the boxes in its reach, and no finish routes it from the shape of the board round it.
export const arrowGeometryCache = () =>
  createArrowGeometryCache<Element, ReturnType<typeof arrowViewGeometry>>({
    isArrow: (el) => el.type === 'arrow',
    ends: (arrow) => [(arrow as ArrowElement).from, (arrow as ArrowElement).to],
    reach: ({ frame }) => routeBehindQueryRect(frame.from, frame.to),
    structural: () => false,
  });
