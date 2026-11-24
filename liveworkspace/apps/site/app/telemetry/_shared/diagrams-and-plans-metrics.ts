// Diagrams and Plans' charts and sentences (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "Telemetry"):
// livediagram's Make Plan Cards and the plan's change offers on a drawn tab, and liveplanner's View As Diagram. Each
// app sends its own; the type is the feature's, never a plan, a card, a shape or any words. An app's config lists its
// stack, and its event-explanations spread the sentences.

import type { Metric, MetricStack } from './metric-series';

export const MAKE_PLAN_CARDS_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'MakePlanCards',
  title: 'Make Plan Cards Opened',
  blurb: "Make Plan Cards' preview opened, from a selection's toolbar or a tab's menu.",
};

export const MAKE_PLAN_CARDS_MADE: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'MakePlanCards',
  title: 'Plan Cards Made',
  blurb:
    'A make that wrote its cards in a liveplanner plan, new or updated. Read against the preview opened.',
};

export const MAKE_PLAN_CARDS_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'MakePlanCards',
  title: 'Make Plan Cards Refused',
  blurb:
    'A make the plan or the index turned away: a limit reached, no edit on the plan, or offline.',
  rising: 'bad',
};

export const PLAN_CHANGES_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'PlanChange',
  title: 'Plan Changes Reviewed',
  blurb: 'The changes-to-the-plan pill opened on a tab View As Diagram drew.',
};

export const PLAN_CHANGES_APPLIED: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'PlanChange',
  title: 'Plan Changes Applied',
  blurb:
    "A drawing's edit applied to its plan: a Blocked By added or a card moved to another column.",
};

export const PLAN_CHANGES_DISMISSED: Metric = {
  category: 'UI',
  action: 'Closed',
  type: 'PlanChange',
  title: 'Plan Changes Dismissed',
  blurb: 'An offered change dismissed, left off the plan.',
};

export const PLAN_CHANGES_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'PlanChange',
  title: 'Plan Changes Refused',
  blurb:
    'An offered change the plan turned away: a loop, a card gone, no edit on the plan, or offline.',
  rising: 'bad',
};

export const MAKE_PLAN_CARDS: MetricStack = {
  stack: true,
  title: 'Make Plan Cards',
  blurb:
    "Roadmaps and flows turned into liveplanner cards, and a drawn plan's edits offered back to it: how often each opens, lands or is turned away.",
  headline: MAKE_PLAN_CARDS_MADE,
  members: [
    MAKE_PLAN_CARDS_OPENED,
    MAKE_PLAN_CARDS_MADE,
    MAKE_PLAN_CARDS_REFUSED,
    PLAN_CHANGES_OPENED,
    PLAN_CHANGES_APPLIED,
    PLAN_CHANGES_DISMISSED,
    PLAN_CHANGES_REFUSED,
  ],
};

export const VIEW_AS_DIAGRAM_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'ViewAsDiagram',
  title: 'View As Diagram Opened',
  blurb: "View As Diagram's dialog opened from a Board tab's menu.",
};

export const VIEW_AS_DIAGRAM_MADE: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'ViewAsDiagram',
  title: 'Diagrams Made',
  blurb: 'A board drawn as a live diagram in livediagram. Read against the dialog opened.',
};

export const VIEW_AS_DIAGRAM_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'ViewAsDiagram',
  title: 'View As Diagram Refused',
  blurb:
    'A diagram the index or livediagram turned away: a limit reached, no read on the board, or offline.',
  rising: 'bad',
};

export const VIEW_AS_DIAGRAM: MetricStack = {
  stack: true,
  title: 'View As Diagram',
  blurb:
    'Boards drawn as live diagrams in livediagram: how often the dialog opens, and how many diagrams are made or turned away.',
  headline: VIEW_AS_DIAGRAM_MADE,
  members: [VIEW_AS_DIAGRAM_OPENED, VIEW_AS_DIAGRAM_MADE, VIEW_AS_DIAGRAM_REFUSED],
};

// Types whose Opened lives in these stacks, never in an app's catch-all Opened chart.
export const DIAGRAMS_AND_PLANS_OPENED = new Set(['MakePlanCards', 'PlanChange', 'ViewAsDiagram']);

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const MAKE_PLAN_CARDS_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|MakePlanCards':
    "Someone opened Make Plan Cards to turn a diagram's shapes into plan cards.",
  'UI|Created|MakePlanCards': "Someone made or updated plan cards from a diagram's shapes.",
  'UI|Refused|MakePlanCards': 'A make of plan cards was turned away, or could not reach the plan.',
  'UI|Opened|PlanChange': 'Someone opened the changes their drawing offers to its plan.',
  'UI|Created|PlanChange': "Someone applied a drawing's change to its plan.",
  'UI|Closed|PlanChange': 'Someone dismissed a change their drawing offered to its plan.',
  'UI|Refused|PlanChange': "A drawing's change was turned away by its plan, or could not reach it.",
};

export const VIEW_AS_DIAGRAM_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|ViewAsDiagram': 'Someone opened View As Diagram on a Board tab.',
  'UI|Created|ViewAsDiagram': 'Someone drew a board as a live diagram in livediagram.',
  'UI|Refused|ViewAsDiagram':
    'A diagram of a board was turned away, or livediagram could not be reached.',
};
