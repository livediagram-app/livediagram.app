// A page's suggested edits as its tab's collab push carries them to the index, for its owner's Inbox
// (docs/specs/030-knowledgebase/insights.md "In the owner's Inbox"; liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "What an item pushes"). The whole suggestion stays here; the Inbox gets its texts cut,
// enough to show the change and decide it.
import type { DocumentEnv } from '../types';
import { listPageSuggestions, type StoredSuggestion } from './suggestions';

/** What one suggestion's texts are cut to for the Inbox (the contract's `COLLAB_SUGGESTION_TEXT_MAX`). */
export const INBOX_SUGGESTION_TEXT_MAX = 2_000;
const INBOX_REASON_MAX = 500;
const INBOX_AGENT_MAX = 200;

export type InboxSuggestionPush = {
  id: string;
  ownerId: string | null;
  agent: string;
  reason: string;
  kind: 'replace' | 'append';
  before: string;
  after: string;
  createdAt: number;
};

/** One stored suggestion as the push carries it: `ownerId` the page's owner, null for a page with none (the index
 *  reads that as the knowledgebase's owner). */
export const suggestionPushOf = (
  s: StoredSuggestion,
  ownerId: string | null,
): InboxSuggestionPush => ({
  id: s.id,
  ownerId,
  agent: s.agent.slice(0, INBOX_AGENT_MAX),
  reason: s.reason.slice(0, INBOX_REASON_MAX),
  kind: s.kind,
  before: s.before.slice(0, INBOX_SUGGESTION_TEXT_MAX),
  after: s.after.slice(0, INBOX_SUGGESTION_TEXT_MAX),
  createdAt: s.createdAt,
});

/** The page's suggestions waiting, newest first, at most the knowledgebase's cap: one read on `suggestions_tab`. */
export async function pageSuggestionsOf(
  env: DocumentEnv,
  tab: string,
  ownerId: string | null,
  now: number,
): Promise<InboxSuggestionPush[]> {
  return (await listPageSuggestions(env, tab, now)).map((s) => suggestionPushOf(s, ownerId));
}
