// The checks, in the spec's code order. The arrow checks (arrow-dangling, arrow-behind-box, edge-crossings,
// label-collision, node-isolated, flow-backwards) went with the arrows, and with them the two that judge the graph
// the arrows drew (box-overlap, aspect-extreme): no box is joined to another since part 4 of the element engine
// (docs/specs/002-project-scope/not-in-livehuddle.md). Their codes stay on the wire.

import { colourOnThemed } from './colour-on-themed';
import { duplicateLabel } from './duplicate-label';
import { labelOverflow } from './label-overflow';
import type { Check } from './types';

export const LINT_CHECKS: readonly Check[] = [labelOverflow, duplicateLabel, colourOnThemed];
