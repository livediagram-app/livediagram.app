// Where an element's indicators sit (docs/specs/008-canvas/element-indicators.md): one copy for every product with
// pages, @liveworkspace/element-model/indicator-placement, bound to the outline this model's canvas hit-tests against
// (./shape-hit).
import { indicatorPlacementFor } from '@liveworkspace/element-model/indicator-placement';
import { pickedByOutline, roundedRectRing, shapeHitOutline } from './shape-hit';
import type { Element } from './index';

export {
  INDICATOR_MIDDLE_CLEARANCE_PX,
  INDICATOR_OUTLINE_CLEARANCE_PX,
  type IndicatorBox,
} from '@liveworkspace/element-model/indicator-placement';

export const {
  centredIndicators,
  indicatorRings,
  topAnchor,
  footerAnchor,
  contentBox,
  placeIndicators,
  pipInset,
  contentShift,
} = indicatorPlacementFor<Element>({ pickedByOutline, shapeHitOutline, roundedRectRing });
