// An agent's suggested edit, accepted or dismissed (docs/specs/015-api/api.md "Knowledge": `POST
// suggestions/<id>/accept`, `POST suggestions/<id>/dismiss`). Written here, against the wire types, while the
// editor's knowledge client (lib/api/knowledge.ts) has no functions for the two routes; they belong there.
import type { AcceptSuggestionResponse } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { apiFetch, expectOk, expectOkVoid } from '@/lib/api/core';
import {
  knowledgeHeaders,
  knowledgeSignal,
  knowledgeUrl,
  type KnowledgeCaller,
} from '@/lib/api/knowledge';

// The refusals the card words itself.
const expected = (code: string | null) => code === 'suggestion_stale' || code === 'forbidden';

const post = async (who: KnowledgeCaller, documentId: string, id: string, verb: string) =>
  apiFetch(knowledgeUrl(documentId, `suggestions/${encodeURIComponent(id)}/${verb}`), {
    method: 'POST',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });

/** Accept: the change is applied to the page as one undo step in the acceptor's name. */
export async function apiAcceptKnowledgeSuggestion(
  who: KnowledgeCaller,
  documentId: string,
  id: string,
): Promise<AcceptSuggestionResponse> {
  const res = await post(who, documentId, id, 'accept');
  return expectOk<AcceptSuggestionResponse>(res, 'accept suggestion', expected);
}

export async function apiDismissKnowledgeSuggestion(
  who: KnowledgeCaller,
  documentId: string,
  id: string,
): Promise<void> {
  await expectOkVoid(await post(who, documentId, id, 'dismiss'), 'dismiss suggestion');
}

export type OverviewAction =
  'accept-suggestion' | 'dismiss-suggestion' | 'dismiss-question' | 'dismiss-conflict' | 'context';

const FALLBACK: Record<OverviewAction, string> = {
  'accept-suggestion': 'The edit could not be accepted. Try again.',
  'dismiss-suggestion': 'The edit could not be dismissed. Try again.',
  'dismiss-question': 'The question could not be dismissed. Try again.',
  'dismiss-conflict': 'The pair could not be dismissed. Try again.',
  context: 'Always in Context could not be changed. Try again.',
};

/** A refused Insights action in words, from its code and status. */
export function overviewFailureText(err: unknown, action: OverviewAction): string {
  if (err instanceof ApiError) {
    if (err.code === 'suggestion_stale')
      return 'The page has changed since this was suggested, so it no longer fits. Open the page to make the change by hand, or dismiss it.';
    if (err.status === 403) return 'Only an Editor can do this.';
    if (err.code === 'tab_busy') return 'The page was being saved. Try again.';
  }
  return FALLBACK[action];
}
