// livediagram's own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint automations.md
// "Kinds"): Poll Ended, Question Asked and Agent Made Changes, each one definition beside the ones every app has
// (@liveworkspace/automations/item). The room queues their events (apps/api document-room/automations/); what each
// event carries is named here so the two never drift. Pure.

import {
  defineEventTrigger,
  defineTrigger,
  eventWho,
  type TriggerKind,
} from '@liveworkspace/automations/item';

// The event kinds the room queues, and the keys of what each carries (an event's `data`).
export const POLL_ENDED_EVENT = 'poll_ended';
export const QUESTION_ASKED_EVENT = 'question_asked';
export const AGENT_CHANGED_EVENT = 'agent_changed';
export const POLL_QUESTION_DATA = 'poll.question';
export const POLL_RESULTS_DATA = 'poll.results';
export const POLL_ANSWERS_DATA = 'poll.answers';
export const QUESTION_DATA = 'question';

// A question's opening, as `{{question}}` reads it.
export const QUESTION_TEXT_MAX = 500;

const pollEnded = defineTrigger({
  kind: POLL_ENDED_EVENT,
  name: 'Poll Ended',
  group: 'Workshop',
  line: 'a facilitator ends a live poll',
  format:
    '{"kind":"poll_ended"} (a facilitator ends a live poll; its question reads as {{poll.question}}, each option ' +
    'and its count as {{poll.results}}, how many answered as {{poll.answers}}, never who answered what)',
  hears: [POLL_ENDED_EVENT],
  read: () => ({ kind: POLL_ENDED_EVENT }),
  defaults: () => ({ kind: POLL_ENDED_EVENT }),
  matches: () => true,
  words: () => [{ chip: 'Poll Ended', trigger: true }],
  said: (_trigger, event) => `${eventWho(event)} ended a poll`,
});

// A note is anonymous to a rule as it is on the board: nobody is behind it.
const questionAsked = defineEventTrigger({
  kind: QUESTION_ASKED_EVENT,
  name: 'Question Asked',
  group: 'Workshop',
  line: 'someone adds a note to a Q&A board',
  note:
    'someone adds a note to a Q&A board; its text reads as {{question}}; notes are anonymous, so nobody is ' +
    'behind it',
  picksTab: true,
  tabbed: true,
  personless: true,
  said: (_who, tab) => `A question was asked on ${tab}`,
});

const agentChanged = defineEventTrigger({
  kind: AGENT_CHANGED_EVENT,
  name: 'Agent Made Changes',
  line: 'an agent changes the canvas through the MCP server, the CLI or the API',
  note: 'an agent, through an API token, changes a tab; once per changeset, {{person}} is the token’s name',
  picksTab: true,
  tabbed: true,
  said: (who, tab) => `${who} changed ${tab}`,
});

/** livediagram's own triggers, in the picker's order. */
export const DOCUMENT_TRIGGERS: readonly TriggerKind[] = [pollEnded, questionAsked, agentChanged];
