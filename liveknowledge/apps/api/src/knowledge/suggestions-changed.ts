// A suggested edit was made, accepted or dismissed (docs/specs/030-knowledgebase/ai-knowledge.md "On the page", "In
// the owner's Inbox"). The `suggestions` triggers (suggestions-outbox.ts) have already written the page's outbox key
// in the write's own transaction; this arms the room's drain for it, since a suggestion is bookkeeping written
// through the handle that notes no edit (knowledge-db.ts), and tells every open editor which pages changed, ids only,
// so each reads its open page's health again once. Never polled.
import type { PageSuggestionsOp } from '@liveknowledge/api-schema';
import { relayPages } from '../room-client';
import type { DocumentEnv } from '../types';

export async function noteSuggestionsChanged(
  env: DocumentEnv,
  documentId: string,
  tabIds: readonly string[],
): Promise<void> {
  if (tabIds.length === 0) return;
  env.OUTBOX_OWED?.();
  const op: PageSuggestionsOp = { kind: 'page-suggestions', tabIds: [...new Set(tabIds)] };
  // Awaited, as a reaction's op is: the person who decided hears it before the answer.
  await relayPages(env, documentId, [op], '[knowledge] suggestions');
}
