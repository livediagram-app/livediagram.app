// The flowchart's step and lane factories for the shared element model's own tests, bound to the
// product-neutral shape builder (./elements) the way each product binds them to its own shape factory.
// A lane is dressed as every product's shape factory dresses one: its title pinned left in the gutter.
// Tests only: nothing in a product or an app imports this.
import type { Element, ShapeElement } from '../element';
import { flowchartStepMakers } from '../flowchart';
import { flowchartGrowth } from '../flowchart-grow';
import { createShape as createPlainShape } from './elements';

export function createShape(kind: string, x: number, y: number): ShapeElement {
  const base = createPlainShape(kind, x, y);
  if (kind !== 'lane') return base;
  return { ...base, textAlignX: 'left', textAlignY: 'middle', padding: 'lg', label: 'Lane' };
}

export const { createFlowchartStep, createFlowchartStart } = flowchartStepMakers(createShape);
export const { planFlowchartStep, addFlowchartLane } = flowchartGrowth<Element>(createShape);
