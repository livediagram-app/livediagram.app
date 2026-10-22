import type { Element } from '@livepages/document';

// Process-style template builders (swimlane, decision tree, approval
// workflow), each pure (cx, cy) -> Element[] in its own file and
// re-exported here: ./template-builders-swimlane,
// ./template-builders-approval and ./template-builders-decision-tree. The
// data-flow diagram lives in ./template-builders-dataflow. See
// docs/specs/008-canvas/canvas-and-palette.md.
export { buildDecisionTree } from './template-builders-decision-tree';
export { buildSwimlane } from './template-builders-swimlane';
export { buildApprovalWorkflow } from './template-builders-approval';

export function buildBlank(): Element[] {
  return [];
}
