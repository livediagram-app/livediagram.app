// Send to Diagram's charts and sentences (liveworkspace/docs/specs/004-index/send-to-diagram.md "Telemetry"), defined
// once for every app that offers it: its code is shared (packages/workbench src/components/send-to-diagram), sent under
// the app's own name through the workbench's `track`. The type is the feature's, never a diagram or any words.

import type { Metric, MetricStack } from './metric-series';

export const SEND_TO_DIAGRAM_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SendToDiagram',
  title: 'Send to Diagram Opened',
  blurb: 'The Send to Diagram picker opened on some words.',
};

export const SEND_TO_DIAGRAM_MADE: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'SendToDiagram',
  title: 'Diagrams Made',
  blurb: 'Words the AI drew as a new livediagram diagram. Read against the picker opened.',
};

export const SEND_TO_DIAGRAM_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'SendToDiagram',
  title: 'Diagrams Refused',
  blurb:
    'A draft or a diagram turned away: a limit reached, no diagram in the words, or livediagram unreachable.',
  rising: 'bad',
};

export const SEND_TO_DIAGRAM: MetricStack = {
  stack: true,
  title: 'Send to Diagram',
  blurb:
    'Words drawn as livediagram diagrams by AI: how often the picker opens, how many diagrams are made, and how many fail.',
  headline: SEND_TO_DIAGRAM_MADE,
  members: [SEND_TO_DIAGRAM_OPENED, SEND_TO_DIAGRAM_MADE, SEND_TO_DIAGRAM_REFUSED],
};

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const SEND_TO_DIAGRAM_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|SendToDiagram':
    'Someone opened Send to Diagram to draw the words they picked as a diagram.',
  'UI|Created|SendToDiagram': 'Someone sent words to a diagram, and AI drew it in livediagram.',
  'UI|Refused|SendToDiagram':
    'A send to a diagram was turned away, or the AI or livediagram could not answer.',
};
