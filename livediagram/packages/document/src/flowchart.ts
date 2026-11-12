// The flowchart (docs/specs/009-elements/flowchart.md): one copy for every product,
// @liveworkspace/element-model/flowchart, with its step factories bound to this model's shape factory.

import { flowchartStepMakers } from '@liveworkspace/element-model/flowchart';
import { createShape } from './shape-factory';
import type { ShapeElement } from './index';

export * from '@liveworkspace/element-model/flowchart';

export const { createFlowchartStep, createFlowchartStart } =
  flowchartStepMakers<ShapeElement>(createShape);
