import { describe, expect, it } from 'vitest';
import {
  flowchartConnectors,
  flowchartDirectionOf,
  flowchartIds,
  flowchartLanes,
  flowchartSteps,
  layoutFlowchart,
  type Element,
} from '@livepages/document';
import { buildFlowchart } from './template-builders-flowchart';
import { buildDecisionTree } from './template-builders-decision-tree';
import { buildSwimlane } from './template-builders-swimlane';
import { buildApprovalWorkflow } from './template-builders-approval';

// docs/specs/009-elements/flowchart.md "Templates": the flowchart family are live flowcharts, tidy by
// construction, so the first Tab grows them without re-arranging what the template drew.

const CASES: [string, (cx: number, cy: number) => Element[], 'down' | 'right', number][] = [
  ['flowchart', buildFlowchart, 'down', 0],
  ['decision tree', buildDecisionTree, 'down', 0],
  ['swimlane', buildSwimlane, 'right', 4],
  ['approval workflow', buildApprovalWorkflow, 'down', 3],
];

describe.each(CASES)('the %s template', (_, build, direction, lanes) => {
  const els = build(500, 400);
  const [id] = flowchartIds(els);

  it('is one live chart flowing its way, with its lanes', () => {
    expect(flowchartIds(els)).toHaveLength(1);
    expect(flowchartSteps(els, id!).length).toBeGreaterThan(3);
    expect(flowchartConnectors(els, id!).length).toBeGreaterThan(2);
    expect(flowchartDirectionOf(els, id!)).toBe(direction);
    expect(flowchartLanes(els, id!)).toHaveLength(lanes);
  });

  it('is already laid out: laying it out again moves nothing', () => {
    const again = layoutFlowchart(els, id!);
    expect(again.steps.size + again.lanes.size + again.connectors.size).toBe(0);
  });
});
