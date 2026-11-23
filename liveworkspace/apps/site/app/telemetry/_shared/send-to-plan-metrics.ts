// Send to Plan's charts and sentences (liveworkspace/docs/specs/004-index/send-to-plan.md "Telemetry"), defined once for
// every app: its code is shared (packages/workbench src/components/send-to-plan), so the events are the same in each
// app, sent under that app's own name through the workbench's `track`. The type is the feature's, never a plan, an
// element or any words. An app's config lists the stack, and its event-explanations spread the sentences.

import type { Metric, MetricStack } from './metric-series';

export const SEND_TO_PLAN_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SendToPlan',
  title: 'Send to Plan Opened',
  blurb: 'The Send to Plan picker opened, from an element, a selection, some words or a thread.',
};

export const SEND_TO_PLAN_SENT: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'SendToPlan',
  title: 'Sent to a Plan',
  blurb: 'A send that made its cards in a liveplanner plan. Read against the picker opened.',
};

export const SEND_TO_PLAN_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'SendToPlan',
  title: 'Send Refused',
  blurb:
    'A send the plan or the index turned away: already sent, a limit reached, no edit on the plan, or offline.',
  rising: 'bad',
};

export const SENT_CARD_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SentCard',
  title: 'Sent Cards Opened',
  blurb: "A source's chip clicked to open its card in liveplanner.",
};

export const SEND_TO_PLAN: MetricStack = {
  stack: true,
  title: 'Send to Plan',
  blurb:
    'Stickies, words and threads turned into liveplanner cards: how often the picker opens, how many sends land or are refused, and how often a chip takes someone to its card.',
  headline: SEND_TO_PLAN_SENT,
  members: [SEND_TO_PLAN_OPENED, SEND_TO_PLAN_SENT, SEND_TO_PLAN_REFUSED, SENT_CARD_OPENED],
};

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const SEND_TO_PLAN_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|SendToPlan':
    'Someone opened Send to Plan to make a liveplanner card from what they picked.',
  'UI|Created|SendToPlan': 'Someone sent to a plan, and its cards were made.',
  'UI|Refused|SendToPlan': 'A send to a plan was turned away, or could not reach the plan.',
  'UI|Opened|SentCard': "Someone clicked a sent place's chip to open its card in liveplanner.",
};

// Any type of the two actions only Send to Plan sends under UI, in the `Category|Action` shape of BY_ACTION.
export const SEND_TO_PLAN_BY_ACTION: Readonly<Record<string, string>> = {
  'UI|Created': 'Someone made something from a picker: a send to a plan, its cards made.',
  'UI|Refused': 'Something someone asked for from a picker was turned away.',
};
