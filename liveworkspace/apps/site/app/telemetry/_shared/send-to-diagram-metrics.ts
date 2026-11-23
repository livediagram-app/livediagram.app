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

export const SEND_TO_DIAGRAM_PREVIEWED: Metric = {
  category: 'UI',
  action: 'Used',
  type: 'SendToDiagram',
  title: 'Diagram Previews',
  blurb: 'Drafts the AI drew and the picker showed as a sketch, before anything was written.',
};

export const SENT_DIAGRAM_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SentDiagram',
  title: 'Diagram Chips Opened',
  blurb: "A sent place's diagram chip pressed, opening its diagram in livediagram.",
};

export const SEND_TO_DIAGRAM_MADE: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'SendToDiagram',
  title: 'Diagrams Made',
  blurb:
    'Words the AI drew in livediagram: a new diagram, a new tab or a tab updated. Read against the picker opened.',
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
    'Words drawn as livediagram diagrams by AI: how often the picker opens and previews, how many diagrams are made, and how many fail.',
  headline: SEND_TO_DIAGRAM_MADE,
  members: [
    SEND_TO_DIAGRAM_OPENED,
    SEND_TO_DIAGRAM_PREVIEWED,
    SEND_TO_DIAGRAM_MADE,
    SEND_TO_DIAGRAM_REFUSED,
  ],
};

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const SEND_TO_DIAGRAM_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|SendToDiagram':
    'Someone opened Send to Diagram to draw the words they picked as a diagram.',
  'UI|Used|SendToDiagram': 'Someone previewed the diagram AI drafted from the words they picked.',
  'UI|Created|SendToDiagram':
    'Someone sent words to a diagram, and AI drew it in livediagram (a new diagram, a new tab or an update).',
  'UI|Refused|SendToDiagram':
    'A send to a diagram was turned away, or the AI or livediagram could not answer.',
};

// The chip is drawn only in an article's writing (packages/workbench send-to-plan/article-sent.ts), so only the apps
// with articles send it: their stack adds it, and their explanation table takes its sentence.
export const SEND_TO_DIAGRAM_WITH_CHIPS: MetricStack = {
  ...SEND_TO_DIAGRAM,
  members: [...SEND_TO_DIAGRAM.members, SENT_DIAGRAM_OPENED],
};

export const SENT_DIAGRAM_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|SentDiagram': "Someone pressed a sent place's diagram chip to open its diagram.",
};
