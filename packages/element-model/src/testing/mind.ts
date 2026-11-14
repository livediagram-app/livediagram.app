// The mind map, its tidy layout and its growth for the shared element model's own tests, bound to the
// product-neutral builders (./elements) the way each product binds them to its own factories.
// Tests only: nothing in a product or an app imports this.
import type { Element } from '../element';
import { mindGrowFor } from '../mind-grow';
import { mindLayoutFor } from '../mind-layout';
import { mindMapFor } from '../mind-map';
import { SHAPE_DEFAULT_SIZE, createPinnedArrow, createShape } from './elements';

export const MIND_MAP = mindMapFor<Element>({
  createMindNode: () => createShape('mind-node', 0, 0),
  createPinnedArrow,
});
export const MIND_LAYOUT = mindLayoutFor<Element>(MIND_MAP);
export const MIND_GROW = mindGrowFor<Element>({
  createMindNode: () => createShape('mind-node', 0, 0),
  createPinnedArrow,
  mindNodeSize: SHAPE_DEFAULT_SIZE['mind-node']!,
  mindMap: MIND_MAP,
  mindLayout: MIND_LAYOUT,
});
