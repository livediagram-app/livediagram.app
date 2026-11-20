// The nine checks, in the spec's code order.

import { arrowBehindBox } from './arrow-behind-box';
import { arrowDangling } from './arrow-dangling';
import { boxOverlap } from './box-overlap';
import { duplicateLabel } from './duplicate-label';
import { edgeCrossings } from './edge-crossings';
import { flowBackwards } from './flow-backwards';
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
  duplicateLabel,
  flowBackwards,
];
