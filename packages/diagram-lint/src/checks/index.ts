// The thirteen checks, in the spec's code order.

import { arrowBehindBox } from './arrow-behind-box';
import { arrowDangling } from './arrow-dangling';
import { aspectExtreme } from './aspect-extreme';
import { boxOverlap } from './box-overlap';
import { colourOnThemed } from './colour-on-themed';
import { duplicateLabel } from './duplicate-label';
import { edgeCrossings } from './edge-crossings';
import { flowBackwards } from './flow-backwards';
import { groupEscape } from './group-escape';
import { groupSplitEdges } from './group-split-edges';
import { labelCollision } from './label-collision';
import { labelOverflow } from './label-overflow';
import { nodeIsolated } from './node-isolated';
import type { Check } from './types';

export const LINT_CHECKS: readonly Check[] = [
  boxOverlap,
  arrowDangling,
  arrowBehindBox,
  edgeCrossings,
  labelCollision,
  labelOverflow,
  nodeIsolated,
  groupEscape,
  groupSplitEdges,
  duplicateLabel,
  flowBackwards,
  aspectExtreme,
  colourOnThemed,
];
