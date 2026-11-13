// Mind-map growth (docs/specs/009-elements/mind-node.md): where a new node goes, and what connects it. One copy
// for livediagram and liveplanner, @liveworkspace/element-model/mind-map, bound to this model's element union and
// its mind-node and connector factories.
import { mindMapFor } from '@liveworkspace/element-model/mind-map';
import { createPinnedArrow } from './factories';
import { createShape } from './shape-factory';
import type { Element } from './index';

export {
  MIND_CHILD_GAP_X,
  MIND_SIBLING_GAP_Y,
  type MindShift,
} from '@liveworkspace/element-model/mind-map';

export const MIND_MAP = mindMapFor<Element>({
  createMindNode: () => createShape('mind-node', 0, 0),
  createPinnedArrow,
});

export const {
  isMindNode,
  mindChildren,
  mindSubtree,
  withMindBranches,
  mindRootOf,
  makeRoom,
  mindFlowOf,
  mindSpacingOf,
  nextMindChildPosition,
  treeIds,
  growMindChild,
  growMindSibling,
} = MIND_MAP;
