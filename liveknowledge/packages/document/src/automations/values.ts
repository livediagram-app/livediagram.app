// liveknowledge's own values (docs/specs/013-workspace/automations.md "Values of its own"): what a rule's text may
// read of a knowledgebase's own triggers, from the event the room queued (triggers.ts names the keys), and the run's
// page's owner, which the room reads (`page.owner`, apps/api document-room/automations/kit-knowledge.ts). Pure.

import type { ValueKind } from '@liveworkspace/automations/item';
import {
  OTHER_PAGE_DATA,
  PAGES_DISAGREE_EVENT,
  QUESTION_DATA,
  QUESTION_UNANSWERED_EVENT,
  SUGGESTION_ADDED_EVENT,
  SUGGESTION_REASON_DATA,
  VERSION_NAMED_EVENT,
  VERSION_NAME_DATA,
  VERSION_RESTORED_EVENT,
} from './triggers';

// The room's own value: the run's page's owner, by name.
export const PAGE_OWNER_VALUE = 'page.owner';
// What `{{page.owner}}` reads for a page nobody owns.
export const NO_OWNER_WORD = 'Nobody';

const dataOf = (key: string) => (ctx: Parameters<ValueKind['fill']>[0]) => {
  const value = ctx.event.data?.[key];
  return value === undefined ? '' : String(value);
};

/** liveknowledge's own values, in the order Insert a Value lists them. */
export const DOCUMENT_VALUES: readonly ValueKind[] = [
  // Filled by the room (kit.values); '' where the run has no page.
  { name: PAGE_OWNER_VALUE, label: 'Page Owner', fill: () => '' },
  {
    name: 'question',
    label: 'Question',
    under: [QUESTION_UNANSWERED_EVENT, PAGES_DISAGREE_EVENT],
    fill: dataOf(QUESTION_DATA),
  },
  {
    name: 'other.name',
    label: 'Other Page Name',
    under: [PAGES_DISAGREE_EVENT],
    fill: (ctx) => {
      const other = ctx.event.data?.[OTHER_PAGE_DATA];
      return ctx.outline.tabs.find((t) => t.id === other)?.name ?? '';
    },
  },
  {
    name: 'suggestion.reason',
    label: 'Suggestion Reason',
    under: [SUGGESTION_ADDED_EVENT],
    fill: dataOf(SUGGESTION_REASON_DATA),
  },
  {
    name: 'version.name',
    label: 'Version Name',
    under: [VERSION_NAMED_EVENT, VERSION_RESTORED_EVENT],
    fill: dataOf(VERSION_NAME_DATA),
  },
];
