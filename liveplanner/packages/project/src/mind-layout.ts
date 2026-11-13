// Tidy mind-map layout (docs/specs/009-elements/mind-node.md "A tidy map stays tidy"): one copy for livediagram and
// liveplanner, @liveworkspace/element-model/mind-layout, bound to this model's mind map.
import { mindLayoutFor } from '@liveworkspace/element-model/mind-layout';
import { MIND_MAP } from './mind-map';
import type { Element } from './index';

export type { MindLayout, MindPoint } from '@liveworkspace/element-model/mind-layout';

export const MIND_LAYOUT = mindLayoutFor<Element>(MIND_MAP);

export const { mindNodesInOrder, layoutMindTree, isMindTreeTidy, reanchorMindConnectors } =
  MIND_LAYOUT;
