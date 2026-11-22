// Approval and the comments at a page's foot from the editor (docs/specs/030-knowledgebase/approval.md,
// page-comments.md): one request each through the knowledge funnel (lib/api/knowledge.ts), the refusals the
// interface words itself kept out of the failure report.
import type {
  PageApprovalAction,
  PageKnowledge,
  PageKnowledgeResponse,
  PageThread,
  PageThreadChange,
  PageThreadChangeResponse,
  PageThreadsResponse,
} from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

const EXPECTED = new Set([
  // Approval (knowledge-approval-route.ts).
  'forbidden',
  'approval_needs_account',
  'approval_needs_a_person',
  'already_pending',
  'not_pending',
  'own_request',
  'not_your_request',
  'note_too_long',
  'tab_busy',
  // Threads (page-thread-changes.ts, knowledge-thread-routes.ts).
  'missing_text',
  'text_too_long',
  'thread_not_found',
  'comment_not_found',
  'not_your_comment',
  'thread_full',
  'thread_busy',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

const pageUrl = (documentId: string, tab: string, path: string) =>
  knowledgeUrl(documentId, `pages/${encodeURIComponent(tab)}/${path}`);

async function post(who: KnowledgeCaller, url: string, body: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    headers: await knowledgeHeaders(who, true),
    body: JSON.stringify(body),
    signal: knowledgeSignal(),
  });
}

/** Request, withdraw, approve or reject (a reject may carry a note). Answers the page's knowledge as stored. */
export async function apiPageApproval(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  action: PageApprovalAction,
  note?: string,
): Promise<PageKnowledge> {
  const res = await post(who, pageUrl(documentId, tab, 'approval'), {
    action,
    ...(note ? { note } : {}),
  });
  return (await expectOk<PageKnowledgeResponse>(res, `${action} approval`, expected)).knowledge;
}

/** The page's threads, oldest first. */
export async function apiPageThreads(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
): Promise<PageThread[]> {
  const res = await apiFetch(pageUrl(documentId, tab, 'threads'), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return (await expectOk<PageThreadsResponse>(res, 'read page comments', expected)).threads;
}

/** One change to the page's threads. Answers the thread as stored, or the id of the thread it removed. */
export async function apiChangePageThread(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  change: PageThreadChange,
): Promise<PageThreadChangeResponse> {
  const res = await post(who, pageUrl(documentId, tab, 'threads'), change);
  return expectOk<PageThreadChangeResponse>(res, `${change.op} page comment`, expected);
}
