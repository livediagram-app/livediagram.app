// The steps of Show Me in a Sankey's Flows dialog (docs/specs/009-elements/sankey.md "Show Me"): a tour of writing a
// Sankey's flows, run on the dialog itself. Each step brings forward the tab its control sits on and scrolls the
// control into view; the control stays usable, so the person can type a flow or rename a node while the step is up.
import type { TourStepOf } from './tour-step';

export type SankeyFlowsTourApi = {
  // Brings the Table tab forward (the Text tab may be showing).
  showTable: () => void;
  // Brings the Text tab forward, carrying the flows across as switching by hand does.
  showText: () => void;
};

type SankeyFlowsTourStep = TourStepOf<SankeyFlowsTourApi>;

// What the dialog holds when Show Me is pressed, which fixes the steps for the whole tour.
export type SankeyFlowsTourContext = {
  // The draft has at least one node, so the node strip is there to point at.
  hasNodes: boolean;
  // A middle node's in and out differ, so the balance notes are showing.
  hasBalanceNotes: boolean;
};

const step = (
  id: string,
  title: string,
  body: string,
  target: string,
  tab: 'table' | 'text' | null,
): SankeyFlowsTourStep => ({
  id,
  title,
  body,
  target,
  prepare: (api) => {
    if (tab === 'table') api.showTable();
    if (tab === 'text') api.showText();
  },
});

const NODES = step(
  'nodes',
  'Your Nodes',
  'Click a node to rename it everywhere.',
  'sankey-nodes',
  null,
);

const ROWS = step(
  'rows',
  'Flows, Step by Step',
  'Each node lists where it sends, and how much.',
  'sankey-rows',
  'table',
);

const ADD = step(
  'add',
  'Add a Flow',
  'Fill in From, To and Amount. Paste rows to add many.',
  'sankey-add-flow',
  'table',
);

const BALANCE = step(
  'balance',
  'In and Out Differ',
  'These send more than they receive. Usually a typo.',
  'sankey-balance',
  'table',
);

// The Text tab, put back to the Table on leaving, so the rest of the tour and the dialog after it read as before.
const TEXT: SankeyFlowsTourStep = {
  ...step(
    'text',
    'Or Type Them',
    'One flow per line: Salary [3200] Budget.',
    'sankey-text',
    'text',
  ),
  cleanup: (api) => api.showTable(),
};

const IMPORT = step(
  'import',
  'Import a File',
  'Load a CSV file to replace the flows.',
  'sankey-import',
  null,
);

const PREVIEW = step(
  'preview',
  'Live Preview',
  'Redraws as you type. Hover to read amounts.',
  'sankey-preview',
  null,
);

const OUTRO: SankeyFlowsTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is the Flows Dialog',
  body: 'Double-click the Sankey to come back here.',
};

// The steps for this dialog: the node strip and the steps only once there are nodes, the balance notes only while
// they show.
export function sankeyFlowsTourSteps({
  hasNodes,
  hasBalanceNotes,
}: SankeyFlowsTourContext): SankeyFlowsTourStep[] {
  return [
    ...(hasNodes ? [NODES, ROWS] : []),
    ADD,
    ...(hasBalanceNotes ? [BALANCE] : []),
    TEXT,
    IMPORT,
    PREVIEW,
    OUTRO,
  ];
}
