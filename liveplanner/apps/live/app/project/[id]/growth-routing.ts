// One growth API for both structures the keyboard grows (docs/specs/009-elements/mind-node.md,
// docs/specs/009-elements/flowchart.md). Tab and Enter, the label editor's keys, the typing-ahead
// handoff and Escape on an empty grown node all reach growth through `canGrow` / `grow` / `abandon` /
// `escapeGrown`; routing here lets every one of them serve a flowchart step without a second copy of
// that plumbing. A child is a step's next step, a sibling a parallel one.
import type { FlowchartGrowth } from '@liveplanner/project';

type MindGrowthApi = {
  canGrowMindNode: (id: string) => boolean;
  growMindNode: (id: string, kind: 'child' | 'sibling') => void;
  abandonMindNode: (id: string) => boolean;
  escapeGrownMindNode: (id: string) => boolean;
};

type FlowchartGrowthApi = {
  canGrowFlowchartStep: (id: string) => boolean;
  growFlowchartStep: (id: string, kind: FlowchartGrowth) => void;
  abandonFlowchartStep: (id: string) => boolean;
  escapeGrownFlowchartStep: (id: string) => boolean;
};

const flowchartGrowthOf = (kind: 'child' | 'sibling'): FlowchartGrowth =>
  kind === 'child' ? 'next' : 'parallel';

export function routeGrowth(mind: MindGrowthApi, flow: FlowchartGrowthApi): MindGrowthApi {
  return {
    canGrowMindNode: (id) => mind.canGrowMindNode(id) || flow.canGrowFlowchartStep(id),
    growMindNode: (id, kind) =>
      flow.canGrowFlowchartStep(id)
        ? flow.growFlowchartStep(id, flowchartGrowthOf(kind))
        : mind.growMindNode(id, kind),
    abandonMindNode: (id) => mind.abandonMindNode(id) || flow.abandonFlowchartStep(id),
    escapeGrownMindNode: (id) => mind.escapeGrownMindNode(id) || flow.escapeGrownFlowchartStep(id),
  };
}
