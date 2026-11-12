// Growing and reshaping a flowchart: one copy for every product, @liveworkspace/element-model/flowchart-grow,
// with the changes that make a step or a lane bound to this model's shape factory.

import { flowchartGrowth } from '@liveworkspace/element-model/flowchart-grow';
import { createShape } from './shape-factory';
import type { Element } from './index';

export * from '@liveworkspace/element-model/flowchart-grow';

export const { planFlowchartStep, addFlowchartLane } = flowchartGrowth<Element>(createShape);
