import { describe, expect, it, vi } from 'vitest';
import { addFlowchartLane, createFlowchartStart, type ShapeElement } from '@livepages/document';
import type { FlowchartActions } from '@/hooks/canvas/useFlowchartSetters';
import { flowchartStepToolbarFor } from './flowchart-step-toolbar';

// docs/specs/009-elements/flowchart.md "Share roles": Add Step / Add Branch for whoever grows the chart,
// Step Type and Lane for an Editor only.

const start = { ...createFlowchartStart(0, 0), id: 'start', flowchartId: 'start' };
const actions = (): FlowchartActions =>
  ({ setStepType: vi.fn(), moveToLane: vi.fn() }) as unknown as FlowchartActions;

describe('flowchartStepToolbarFor', () => {
  it('offers growth to anyone, routed as a child and a sibling', () => {
    const grow = vi.fn();
    const bar = flowchartStepToolbarFor([start], start, grow, undefined);
    bar.onAddStep();
    bar.onAddBranch();
    expect(grow.mock.calls).toEqual([
      ['start', 'child'],
      ['start', 'sibling'],
    ]);
    expect(bar.onSetStepType).toBeUndefined();
    expect(bar.onMoveToLane).toBeUndefined();
  });

  it("gives an Editor the step's type and its chart's lanes in drawn order", () => {
    const els = addFlowchartLane([start], 'start', ['l1', 'l2']);
    const s = els.find((e) => e.id === 'start') as ShapeElement;
    const a = actions();
    const bar = flowchartStepToolbarFor(els, s, vi.fn(), a);
    expect(bar.stepType).toBe('terminator');
    expect(bar.lanes).toEqual([
      { id: 'l1', title: 'Lane 1' },
      { id: 'l2', title: 'Lane 2' },
    ]);
    expect(bar.laneId).toBe('l1');
    bar.onSetStepType!('decision');
    bar.onMoveToLane!('l2');
    expect(a.setStepType).toHaveBeenCalledWith('start', 'decision');
    expect(a.moveToLane).toHaveBeenCalledWith('start', 'l2');
  });
});
