// Where a new arrow starts at its exact anchor by default (docs/specs/008-canvas/arrow-anchors.md "Start at Exact
// Anchor"): a mind node's connectors and a flowchart's connectors leave the very point they are pinned to, so a
// parent's children, or a step's exits, share one start like a tree's trunk instead of fanning along the edge.
// A default only: it is set when the arrow is made, the arrow's own switch turns it off, and arrows already
// stored keep what they have.

import { isFlowchartStep } from './flowchart';
import type { Element } from './element';

/** Whether a new arrow whose start is pinned to `from` starts exactly on its anchor: from a mind node or a flowchart step. */
export function startsAtExactAnchor(from: Element | null | undefined): boolean {
  if (!from) return false;
  return (from.type === 'shape' && from.shape === 'mind-node') || isFlowchartStep(from);
}
