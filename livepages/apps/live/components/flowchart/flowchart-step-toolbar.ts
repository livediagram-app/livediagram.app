// What a selected flowchart step's toolbar offers (docs/specs/009-elements/flowchart.md "Share roles"):
// Add Step and Add Branch to whoever may grow the chart; Step Type and Lane to an Editor only, who is
// the one handed `actions`.
import {
  flowchartLanes,
  flowchartStepTypeOf,
  type Element,
  type ShapeElement,
} from '@livepages/document';
import type { FlowchartActions } from '@/hooks/canvas/useFlowchartSetters';
import type { FlowchartStepToolbar } from '@/components/flowchart/FlowchartStepButtons';

// Lanes as they are drawn: down the stack for rows, across it for columns.
const drawnOrder = (a: ShapeElement, b: ShapeElement) =>
  a.width >= a.height ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y;

export function flowchartStepToolbarFor(
  elements: readonly Element[],
  step: ShapeElement,
  grow: (id: string, kind: 'child' | 'sibling') => void,
  actions: FlowchartActions | undefined,
): FlowchartStepToolbar {
  const lanes = [...flowchartLanes(elements, step.flowchartId!)].sort(drawnOrder);
  return {
    onAddStep: () => grow(step.id, 'child'),
    onAddBranch: () => grow(step.id, 'sibling'),
    ...(actions
      ? {
          stepType: flowchartStepTypeOf(step.shape),
          onSetStepType: (type) => actions.setStepType(step.id, type),
          lanes: lanes.map((l) => ({ id: l.id, title: l.label ?? '' })),
          laneId: lanes.some((l) => l.id === step.flowLaneId) ? step.flowLaneId : lanes[0]?.id,
          onMoveToLane: (laneId) => actions.moveToLane(step.id, laneId),
        }
      : {}),
  };
}
