// Suggestions' charts and sentences (liveworkspace/docs/specs/016-notifications/suggestions.md "Telemetry"), defined
// once: the code is shared (packages/workbench src/components/suggest), so each suggestion counts the same way in the
// app that offers it, under that app's name: shown (`UI·Opened`), taken (`UI·Used`) and dismissed (`UI·Closed`), typed
// by the suggestion, never the item or its words. An app's config lists its suggestion's stack, and its
// event-explanations spread the sentences, so a weak suggestion can be cut.

import type { Metric, MetricStack } from './metric-series';

type Offer = { type: string; title: string; does: string };

function stack({ type, title, does }: Offer): MetricStack {
  const shown: Metric = {
    category: 'UI',
    action: 'Opened',
    type,
    title: `${title} Shown`,
    blurb: `The ${title} suggestion shown: ${does}`,
  };
  const taken: Metric = {
    category: 'UI',
    action: 'Used',
    type,
    title: `${title} Taken`,
    blurb: `${title} taken in one click. Read against shown.`,
  };
  const dismissed: Metric = {
    category: 'UI',
    action: 'Closed',
    type,
    title: `${title} Dismissed`,
    blurb: `${title} dismissed, for the item or for good. Rising against taken says it is a weak suggestion.`,
    rising: 'bad',
  };
  return {
    stack: true,
    title: `Suggestion: ${title}`,
    blurb: `How often ${title} is suggested, taken and dismissed.`,
    headline: taken,
    members: [shown, taken, dismissed],
  };
}

const MAKE_PLAN: Offer = {
  type: 'SuggestMakePlan',
  title: 'Make These a Plan',
  does: '3 or more action stickies offered to a liveplanner plan.',
};
const WRITE_UP: Offer = {
  type: 'SuggestWriteUp',
  title: 'Write It Up',
  does: 'a done card with a decision offered to the knowledgebase.',
};
const ADD_TO_KB: Offer = {
  type: 'SuggestAddToKnowledgebase',
  title: 'Add to Knowledgebase',
  does: 'an article explaining a process offered to the knowledgebase.',
};
const BRING_IN: Offer = {
  type: 'SuggestBringIn',
  title: 'Bring In Your Diagrams and Docs',
  does: "a new knowledgebase offered the person's recent diagrams and documents.",
};
const SEND_TO_PLAN: Offer = {
  type: 'SuggestSendToPlan',
  title: 'Send to a Plan',
  does: "a call's stickies offered to a liveplanner plan when it ends.",
};

// Every suggestion's type, so an app's Other Panels Opened chart leaves them to their own stacks.
const TYPES = new Set([MAKE_PLAN, WRITE_UP, ADD_TO_KB, BRING_IN, SEND_TO_PLAN].map((o) => o.type));
export const isSuggestionType = (type: string | null): boolean => type !== null && TYPES.has(type);

export const SUGGEST_MAKE_PLAN = stack(MAKE_PLAN);
export const SUGGEST_WRITE_UP = stack(WRITE_UP);
export const SUGGEST_ADD_TO_KNOWLEDGEBASE = stack(ADD_TO_KB);
export const SUGGEST_BRING_IN = stack(BRING_IN);
export const SUGGEST_SEND_TO_PLAN = stack(SEND_TO_PLAN);

// The sentences of one suggestion, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
function sentences({ type, title }: Offer): Record<string, string> {
  return {
    [`UI|Opened|${type}`]: `The ${title} suggestion was shown in the editor.`,
    [`UI|Used|${type}`]: `Someone took the ${title} suggestion.`,
    [`UI|Closed|${type}`]: `Someone dismissed the ${title} suggestion.`,
  };
}

export const SUGGEST_MAKE_PLAN_EXACT = sentences(MAKE_PLAN);
export const SUGGEST_WRITE_UP_EXACT = sentences(WRITE_UP);
export const SUGGEST_ADD_TO_KNOWLEDGEBASE_EXACT = sentences(ADD_TO_KB);
export const SUGGEST_BRING_IN_EXACT = sentences(BRING_IN);
export const SUGGEST_SEND_TO_PLAN_EXACT = sentences(SEND_TO_PLAN);

// The one switch, the same in every app (Settings › Getting Started › Suggest Other Apps).
export const SUGGESTIONS_SWITCH_EXACT: Readonly<Record<string, string>> = {
  'UI|Toggled|SuggestionsOn': 'Someone turned Suggest Other Apps on in Settings.',
  'UI|Toggled|SuggestionsOff': 'Someone turned Suggest Other Apps off in Settings.',
};
