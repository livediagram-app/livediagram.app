// Send to Knowledge Base's charts and sentences (liveworkspace/docs/specs/004-index/send-to-knowledge.md "Telemetry"),
// defined once for every app: its code is shared (packages/workbench src/components/send-to-knowledge), so the events
// are the same in each app, sent under that app's own name through the workbench's `track`. The type is the
// feature's, never a page, a knowledgebase, an element or any words. A sending app's config lists the stack; a
// receiving one (liveknowledge) sends only the chip's opens.

import type { Metric, MetricStack } from './metric-series';

export const SEND_TO_KNOWLEDGE_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SendToKnowledge',
  title: 'Send to Knowledge Base Opened',
  blurb: 'The Send to Knowledge Base picker opened, from a selection or an element menu.',
};

export const SEND_TO_KNOWLEDGE_WRITTEN: Metric = {
  category: 'UI',
  action: 'Used',
  type: 'SendToKnowledge',
  title: 'Summaries Written',
  blurb: 'An AI summary written for the preview. Read against the sections inserted.',
};

export const SEND_TO_KNOWLEDGE_SENT: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'SendToKnowledge',
  title: 'Sent to a Knowledge Base',
  blurb: 'A section inserted on a liveknowledge page, with or without a summary.',
};

export const SEND_TO_KNOWLEDGE_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'SendToKnowledge',
  title: 'Sends Refused',
  blurb:
    'A summary or a send turned away: the month’s AI credits used, the AI failing, no edit on the knowledgebase, or the page gone.',
  rising: 'bad',
};

export const SENT_KNOWLEDGE_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'SentKnowledge',
  title: 'Sent Sections Opened',
  blurb:
    'A Sent From chip clicked: the element’s to open its page, or the page’s to open its source.',
};

export const SEND_TO_KNOWLEDGE: MetricStack = {
  stack: true,
  title: 'Send to Knowledge Base',
  blurb:
    'Selections written up on liveknowledge pages: how often the picker opens, how many summaries are written and sections inserted or refused, and how often a chip is followed.',
  headline: SEND_TO_KNOWLEDGE_SENT,
  members: [
    SEND_TO_KNOWLEDGE_OPENED,
    SEND_TO_KNOWLEDGE_WRITTEN,
    SEND_TO_KNOWLEDGE_SENT,
    SEND_TO_KNOWLEDGE_REFUSED,
    SENT_KNOWLEDGE_OPENED,
  ],
};

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const SEND_TO_KNOWLEDGE_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|SendToKnowledge':
    'Someone opened Send to Knowledge Base to write up what they picked on a liveknowledge page.',
  'UI|Used|SendToKnowledge': 'An AI summary of a selection was written for the preview.',
  'UI|Created|SendToKnowledge': 'Someone inserted a section on a liveknowledge page.',
  'UI|Refused|SendToKnowledge':
    'A summary or a send to a knowledgebase was turned away, or could not reach it.',
  'UI|Opened|SentKnowledge': 'Someone clicked a Sent From chip to open the other side.',
};

// An app that holds the picker's shared code but neither shows a sent element's chip nor receives sections: the
// picker's events alone.
export const SEND_TO_KNOWLEDGE_PICKER: MetricStack = {
  ...SEND_TO_KNOWLEDGE,
  members: SEND_TO_KNOWLEDGE.members.filter((m) => m !== SENT_KNOWLEDGE_OPENED),
};
export const SEND_TO_KNOWLEDGE_PICKER_EXACT: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SEND_TO_KNOWLEDGE_EXACT).filter(([key]) => key !== 'UI|Opened|SentKnowledge'),
);
