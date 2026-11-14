// Growing and re-laying out a mind map (docs/specs/009-elements/mind-node.md): one copy for livediagram and
// liveplanner, @liveworkspace/element-model/mind-grow, bound to this model's mind map, layout and factories.
import {
  mindGrowFor,
  type MindGrowthPlan as SharedGrowthPlan,
} from '@liveworkspace/element-model/mind-grow';
import { createPinnedArrow } from './factories';
import { MIND_LAYOUT } from './mind-layout';
import { MIND_MAP } from './mind-map';
import { createShape } from './shape-factory';
import { SHAPE_DEFAULT_SIZE } from './shape-default-size';
import type { ArrowElement, Element, ShapeElement } from './index';

export type { MindMove } from '@liveworkspace/element-model/mind-grow';
export type MindGrowthPlan = SharedGrowthPlan<ShapeElement, ArrowElement>;

export const {
  mindStyleSource,
  mindConnectorBetween,
  mindConnectorStyleSource,
  planMindGrowth,
  relayoutMindMap,
  withMindSubtrees,
  applyMindMoves,
} = mindGrowFor<Element>({
  createMindNode: () => createShape('mind-node', 0, 0),
  createPinnedArrow,
  mindNodeSize: SHAPE_DEFAULT_SIZE['mind-node'],
  mindMap: MIND_MAP,
  mindLayout: MIND_LAYOUT,
});
