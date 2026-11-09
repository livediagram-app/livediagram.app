// Which arrows a drag preview must redraw, and how (docs/specs/008-canvas/drag-preview.md "The preview"): the
// workbench's grid-backed arrow work (@liveworkspace/workbench/lib/drag-affected-arrows), bound to this project's
// element model. Linear in what moved per frame (docs/specs/008-canvas/canvas-performance.md).

import {
  buildElementGrid,
  buildElementIndex,
  elementIndexFor,
  endpointPosition,
  isBoxed,
  queryElementGrid,
  resolveFinish,
  routeBehindHoles,
  routeBehindQueryRect,
  type ArrowElement,
  type Element,
  type ElementGrid,
  type ElementIndex,
} from '@liveplanner/project';
import { createDragAffectedArrows } from '@liveworkspace/workbench/lib/drag-affected-arrows';
import { deriveArrowViewFrame, type ArrowViewFrame } from './arrow-view-frame';

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
