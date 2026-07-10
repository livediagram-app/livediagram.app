// The editor's Auto Layout style choices (spec/47 "Layout styles"): the one
// place the UI ids map to `autoLayoutElements` options, display labels, and
// telemetry types. Consumed by the Cleanup menu tiles, the command palette,
// and useTabCanvas so the three surfaces can't drift.

import type { AutoLayoutOptions } from '@livediagram/diagram';

export type AutoLayoutChoice = 'smart' | 'flow-down' | 'flow-right' | 'tree' | 'mindmap';

type ChoiceSpec = {
  // Tile label in the Cleanup menu section.
  menuLabel: string;
  // Command palette entry name + extra search keywords.
  commandName: string;
  keywords: string;
  // What the choice asks of `autoLayoutElements`.
  options: Pick<AutoLayoutOptions, 'style' | 'direction'>;
  // `type` on the Tab/Aligned telemetry event (spec/22: preset token only).
  telemetryType: string;
};

export const AUTO_LAYOUT_CHOICES: Record<AutoLayoutChoice, ChoiceSpec> = {
  smart: {
    menuLabel: 'Auto Layout',
    commandName: 'Auto Layout (tidy up)',
    keywords: 'auto layout tidy arrange clean cleanup organise organize graph',
    options: {},
    telemetryType: 'Smart',
  },
  'flow-down': {
    menuLabel: 'Flowchart ↓',
    commandName: 'Auto Layout: Flowchart (down)',
    keywords: 'auto layout flowchart flow vertical down top bottom arrange',
    options: { style: 'flow', direction: 'TB' },
    telemetryType: 'FlowchartDown',
  },
  'flow-right': {
    menuLabel: 'Flowchart →',
    commandName: 'Auto Layout: Flowchart (right)',
    keywords: 'auto layout flowchart flow horizontal right left sideways arrange',
    options: { style: 'flow', direction: 'LR' },
    telemetryType: 'FlowchartRight',
  },
  tree: {
    menuLabel: 'Tree',
    commandName: 'Auto Layout: Tree',
    keywords: 'auto layout tree org chart hierarchy organogram arrange',
    options: { style: 'tree' },
    telemetryType: 'Tree',
  },
  mindmap: {
    menuLabel: 'Mindmap',
    commandName: 'Auto Layout: Mindmap',
    keywords: 'auto layout mindmap mind map radial hub spoke brainstorm arrange',
    options: { style: 'mindmap' },
    telemetryType: 'Mindmap',
  },
};

// The explicit styles shown as their own tiles / commands, in display order.
// 'smart' stays the plain "Auto Layout" entry rather than joining this row.
export const AUTO_LAYOUT_STYLE_IDS = ['flow-down', 'flow-right', 'tree', 'mindmap'] as const;
