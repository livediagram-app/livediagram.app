import {
  addFlowchartLane,
  flowchartIdOf,
  layoutFlowchart,
  moveStepToLane,
  relayoutFlowchart,
  retypeFlowchartStep,
  setFlowchartDirection,
  type Element,
  type FlowchartDirection,
  type FlowchartStepType,
  type Tab,
} from '@livedesign/document';
import { lockedElementIds } from '@/lib/tab-cleanup';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type FlowchartSetterDeps = {
  currentSelectionIds: () => Set<string>;
  // History-aware active-tab mutator: a change and its layout are one undo step, and the layout
  // reads the tab's layers for what is locked.
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
  // The active tab's elements now, to tell a tidy that moves steps from one that moves none.
  elements: () => Element[];
  // Changing a step's type, the direction or the lanes reshapes the chart: an Editor's.
  editsBlocked: boolean;
  notify: (tone: 'success' | 'info', message: string) => void;
};

export type FlowchartActions = ReturnType<typeof useFlowchartSetters>;

// The Flowchart menu section's and step toolbar's actions (docs/specs/009-elements/flowchart.md): a
// step's type, the chart's direction, Add Lane, moving a step to a lane and Tidy Flowchart. Each
// lands with the chart's layout in ONE commit. Selection-wide ones act once per chart.
export function useFlowchartSetters({
  currentSelectionIds,
  commitActiveTab,
  elements,
  editsBlocked,
  notify,
}: FlowchartSetterDeps) {
  // `change` maps the tab's elements, given what the layout must leave where it is.
  const commitChange = (change: (els: Element[], locked: Set<string>) => Element[]) => {
    if (editsBlocked) return;
    commitActiveTab((t) => {
      const next = change(t.elements, lockedElementIds(t.elements, t.layers));
      return next === t.elements ? t : { ...t, elements: next };
    });
  };

  // The charts with a selected step or lane, resolved against the elements being changed.
  const chartsOf = (els: Element[], ids: Set<string>) => [
    ...new Set([...ids].flatMap((id) => flowchartIdOf(els, id) ?? [])),
  ];

  const setStepType = (stepId: string, type: FlowchartStepType) => {
    commitChange((els, locked) => retypeFlowchartStep(els, stepId, type, { lockedIds: locked }));
    debugLog(`[flowchart] retype step=${stepId} type=${type}`);
    track('Element', 'Changed', 'FlowchartStepType');
  };

  const setStepTypeSelected = (type: FlowchartStepType) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitChange((els, locked) =>
      [...ids].reduce((acc, id) => retypeFlowchartStep(acc, id, type, { lockedIds: locked }), els),
    );
    debugLog(`[flowchart] retype steps=${ids.size} type=${type}`);
    track('Element', 'Changed', 'FlowchartStepType');
  };

  const setDirectionSelected = (direction: FlowchartDirection) => {
    const ids = currentSelectionIds();
    commitChange((els, locked) =>
      chartsOf(els, ids).reduce(
        (acc, chart) => setFlowchartDirection(acc, chart, direction, { lockedIds: locked }),
        els,
      ),
    );
    debugLog(`[flowchart] direction=${direction}`);
    track('Element', 'Changed', 'FlowchartDirection');
  };

  const addLaneSelected = () => {
    const ids = currentSelectionIds();
    commitChange((els, locked) =>
      chartsOf(els, ids).reduce(
        (acc, chart) =>
          addFlowchartLane(acc, chart, [crypto.randomUUID(), crypto.randomUUID()], {
            lockedIds: locked,
          }),
        els,
      ),
    );
    debugLog('[flowchart] add lane');
    track('Element', 'Added', 'FlowchartLane');
  };

  const moveToLane = (stepId: string, laneId: string) => {
    commitChange((els, locked) => moveStepToLane(els, stepId, laneId, { lockedIds: locked }));
    debugLog(`[flowchart] lane step=${stepId} lane=${laneId}`);
    track('Element', 'Changed', 'FlowchartLane');
  };

  // Tidy Flowchart, saying what it did: "Flowchart tidied", or "Flowchart already tidy".
  const tidySelected = () => {
    const ids = currentSelectionIds();
    const all = elements();
    const charts = chartsOf(all, ids);
    if (charts.length === 0) return;
    const changes = charts.some((chart) => {
      const l = layoutFlowchart(all, chart);
      return l.steps.size + l.lanes.size + l.connectors.size > 0;
    });
    if (changes)
      commitChange((els, locked) =>
        charts.reduce((acc, chart) => relayoutFlowchart(acc, chart, { lockedIds: locked }), els),
      );
    debugLog(`[flowchart] tidy changed=${changes}`);
    notify(changes ? 'success' : 'info', changes ? 'Flowchart tidied' : 'Flowchart already tidy');
    track('Element', 'Changed', 'FlowchartTidy');
  };

  return {
    setStepType,
    setStepTypeSelected,
    setDirectionSelected,
    addLaneSelected,
    moveToLane,
    tidySelected,
  };
}
