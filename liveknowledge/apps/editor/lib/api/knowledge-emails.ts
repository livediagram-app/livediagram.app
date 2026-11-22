// The Knowledgebase Reviews emails an Editor asks for (docs/specs/015-api/api.md "Knowledge": `POST
// conflicts/<id>/ask-owners`, `POST knowledge/remind-owners`). Each answers what was sent or why nothing was; the
// words are lib/knowledge-ask/email-words.ts.
import type { KnowledgeEmailResult } from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

// The refusals the interface words itself.
const expected = (code: string | null) => code === 'forbidden' || code === 'conflict_unknown';

async function post(
  who: KnowledgeCaller,
  documentId: string,
  path: string,
  action: string,
): Promise<KnowledgeEmailResult> {
  const res = await apiFetch(knowledgeUrl(documentId, path), {
    method: 'POST',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOk<KnowledgeEmailResult>(res, action, expected);
}

/** Ask Both Owners: each owner of a conflict's two pages, once a conflict. */
export const apiAskConflictOwners = (
  who: KnowledgeCaller,
  documentId: string,
  conflictId: string,
): Promise<KnowledgeEmailResult> =>
  post(who, documentId, `conflicts/${encodeURIComponent(conflictId)}/ask-owners`, 'ask owners');

/** Remind the Owners: each owner's pages that are Review Due or Never Verified, once a week. */
export const apiRemindOwners = (
  who: KnowledgeCaller,
  documentId: string,
): Promise<KnowledgeEmailResult> =>
  post(who, documentId, 'knowledge/remind-owners', 'remind owners');
