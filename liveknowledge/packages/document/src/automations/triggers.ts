// liveknowledge's own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint
// automations.md "Kinds"): what a knowledgebase knows of its pages (who owns them, whether they are verified, what
// Ask and agents could not answer, which pages disagree, what agents suggested and wrote) and its versions, each one
// definition beside the ones every app has (@liveworkspace/automations/item). The room queues their events (apps/api
// document-room/automations/knowledge-events.ts, version-events.ts); what each event carries is named here so the
// two never drift. Pure.

import {
  AGENT_CHANGED_EVENT,
  agentChangedTrigger,
  defineEventTrigger,
  type TriggerKind,
} from '@liveworkspace/automations/item';

export { AGENT_CHANGED_EVENT };

// The event kinds the room queues.
export const PAGE_VERIFIED_EVENT = 'page_verified';
export const REVIEW_DUE_EVENT = 'review_due';
export const OWNER_CHANGED_EVENT = 'owner_changed';
export const QUESTION_UNANSWERED_EVENT = 'question_unanswered';
export const PAGES_DISAGREE_EVENT = 'pages_disagree';
export const SUGGESTION_ADDED_EVENT = 'suggestion_added';
export const VERSION_NAMED_EVENT = 'version_named';
export const VERSION_RESTORED_EVENT = 'version_restored';

// The keys of what the events carry (an event's `data`).
export const VERSION_NAME_DATA = 'version.name';
export const QUESTION_DATA = 'question';
export const OTHER_PAGE_DATA = 'other.tab';
export const SUGGESTION_REASON_DATA = 'suggestion.reason';

const TRUST = 'Trust';
const AI_KNOWLEDGE = 'Insights';
const VERSIONS = 'Versions';

const pageVerified = defineEventTrigger({
  kind: PAGE_VERIFIED_EVENT,
  name: 'Page Verified',
  group: TRUST,
  line: 'someone verifies a page',
  note: 'someone verifies a page, saying it is right; {{person}} is who verified it',
  picksTab: true,
  tabbed: true,
  said: (who, page) => `${who} verified ${page}`,
});

const reviewDue = defineEventTrigger({
  kind: REVIEW_DUE_EVENT,
  name: 'Review Due',
  group: TRUST,
  line: 'a verified page’s review comes due',
  note:
    'a verified page’s review comes due (when it was verified plus the knowledgebase’s Review Period); once ' +
    'per review, with nobody behind it',
  picksTab: true,
  tabbed: true,
  personless: true,
  said: (_who, page) => `${page} came due for review`,
});

const ownerChanged = defineEventTrigger({
  kind: OWNER_CHANGED_EVENT,
  name: 'Page Owner Changed',
  group: TRUST,
  line: 'someone gives a page a new owner, or takes its owner away',
  note: 'someone gives a page a new owner, or takes its owner away; {{page.owner}} is the new owner',
  picksTab: true,
  tabbed: true,
  said: (who, page) => `${who} changed the owner of ${page}`,
});

const questionUnanswered = defineEventTrigger({
  kind: QUESTION_UNANSWERED_EVENT,
  name: 'Unanswered Question',
  group: AI_KNOWLEDGE,
  line: 'a question nobody’s pages answer is asked for the first time',
  note:
    'a question nobody’s pages answer is asked for the first time, in Ask, by an agent’s search that found ' +
    'nothing or by report_gap; like questions are one; it reads as {{question}}',
  said: (who) => `${who} asked a question nobody’s pages answer`,
});

const pagesDisagree = defineEventTrigger({
  kind: PAGES_DISAGREE_EVENT,
  name: 'Pages Disagree',
  group: AI_KNOWLEDGE,
  line: 'two pages are found stating opposite facts',
  note:
    'the conflict check finds a new pair of pages stating opposite facts; the page is the one whose save or ' +
    'verify started the check, {{other.name}} the other and {{question}} what they disagree on; nobody is behind it',
  picksTab: true,
  tabbed: true,
  personless: true,
  said: (_who, page) => `${page} disagrees with another page`,
});

const suggestionAdded = defineEventTrigger({
  kind: SUGGESTION_ADDED_EVENT,
  name: 'Agent Suggested a Change',
  group: AI_KNOWLEDGE,
  line: 'an agent suggests an edit to a page',
  note:
    'an agent with the suggest scope suggests an edit to a page; {{person}} is the agent’s name and ' +
    '{{suggestion.reason}} its reason',
  picksTab: true,
  tabbed: true,
  said: (who, page) => `${who} suggested an edit to ${page}`,
});

const agentChanged: TriggerKind = {
  ...agentChangedTrigger({
    line: 'an agent writes a page through the MCP server, the CLI or the API',
    note: 'an agent, through an API token, makes or writes a page; once per write, {{person}} is the token’s name',
  }),
  group: AI_KNOWLEDGE,
};

const versionNamed = defineEventTrigger({
  kind: VERSION_NAMED_EVENT,
  name: 'Version Named',
  group: VERSIONS,
  line: 'someone names a version of a page',
  note: 'someone names a version of a page; its name reads as {{version.name}}',
  picksTab: true,
  tabbed: true,
  said: (who, page) => `${who} named a version of ${page}`,
});

const versionRestored = defineEventTrigger({
  kind: VERSION_RESTORED_EVENT,
  name: 'Version Restored',
  group: VERSIONS,
  line: 'someone restores a page to an earlier version',
  note: 'someone restores a page to an earlier version; its name, when it has one, reads as {{version.name}}',
  picksTab: true,
  tabbed: true,
  said: (who, page) => `${who} restored a version of ${page}`,
});

/** liveknowledge's own triggers, in the picker's order. */
export const DOCUMENT_TRIGGERS: readonly TriggerKind[] = [
  pageVerified,
  reviewDue,
  ownerChanged,
  questionUnanswered,
  pagesDisagree,
  suggestionAdded,
  agentChanged,
  versionNamed,
  versionRestored,
];
