// The editor's Auto Layout style choices (docs/specs/008-canvas/layout-cleanup.md "Layout styles"): the one
// place the UI ids map to `autoLayoutElements` options, display labels, and
// telemetry types. Consumed by the command palette and useTabCanvas so the two
// can't drift.

import type { AutoLayoutOptions } from '@livediagram/document';

export type AutoLayoutChoice = 'smart' | 'flow-down' | 'flow-right' | 'tree' | 'mindmap';

type ChoiceSpec = {
  // Command palette entry name + extra search keywords.
  commandName: string;
  keywords: string;
  // What the choice asks of `autoLayoutElements`.
  options: Pick<AutoLayoutOptions, 'style' | 'direction'>;
  // `type` on the Tab/Aligned telemetry event (docs/specs/017-telemetry/telemetry.md: preset token only).
  telemetryType: string;
};

export const AUTO_LAYOUT_CHOICES: Record<AutoLayoutChoice, ChoiceSpec> = {
  smart: {
    commandName: 'Auto Layout (tidy up)',
    keywords: 'auto layout tidy arrange clean cleanup organise organize graph',
    options: {},
    telemetryType: 'Smart',
  },
  'flow-down': {
    commandName: 'Auto Layout: Flowchart (down)',
    keywords: 'auto layout flowchart flow vertical down top bottom arrange',
    options: { style: 'flow', direction: 'TB' },
    telemetryType: 'FlowchartDown',
  },
  'flow-right': {
    commandName: 'Auto Layout: Flowchart (right)',
    keywords: 'auto layout flowchart flow horizontal right left sideways arrange',
    options: { style: 'flow', direction: 'LR' },
    telemetryType: 'FlowchartRight',
  },
  tree: {
    commandName: 'Auto Layout: Tree',
    keywords: 'auto layout tree org chart hierarchy organogram arrange',
    options: { style: 'tree' },
    telemetryType: 'Tree',
  },
  mindmap: {
    commandName: 'Auto Layout: Mindmap',
    keywords: 'auto layout mindmap mind map radial hub spoke brainstorm arrange',
    options: { style: 'mindmap' },
    telemetryType: 'Mindmap',
  },
};

// The explicit styles shown as their own tiles / commands, in display order.
// 'smart' stays the plain "Auto Layout" entry rather than joining this row.
export const AUTO_LAYOUT_STYLE_IDS = ['flow-down', 'flow-right', 'tree', 'mindmap'] as const;
