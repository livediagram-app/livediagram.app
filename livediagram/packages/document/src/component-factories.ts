// The palette's ready-made components (docs/specs/008-canvas/canvas-and-palette.md,
// docs/specs/009-elements/web-components-and-no-groups.md): one copy for livediagram and liveplanner,
// @liveworkspace/element-model/component-factories, bound to this model's shape factory, kind sizes and
// flowchart start.
import { componentFactoriesFor } from '@liveworkspace/element-model/component-factories';
import { createFlowchartStart } from './flowchart';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import type { Element } from './index';

export type { ComponentKind } from '@liveworkspace/element-model/component-factories';

export const {
  componentShapeKind,
  createAvatar,
  createHero,
  createCalloutCard,
  createComponent,
  COMPONENT_SIZE,
} = componentFactoriesFor<Element, Parameters<typeof createShape>[0]>({
  createShape,
  shapeDefaultSize: SHAPE_DEFAULT_SIZE,
  createFlowchartStart: (cx, cy) => createFlowchartStart(cx, cy),
});
