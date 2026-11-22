// Approval, the comments at a page's foot, its reactions and its watch from the editor (docs/specs/030-knowledgebase/
// approval.md, page-comments.md, page-reactions.md, watching.md): one request each through the knowledge funnel (lib/api/knowledge.ts), the refusals the
// interface words itself kept out of the failure report.
import type {
  PageApprovalAction,
  PageKnowledge,
  PageKnowledgeResponse,
  PageReaction,
  PageReactionChange,
  PageReactionChangeResponse,
  PageReactionsResponse,
  PageThread,
  PageThreadChange,
  PageThreadChangeResponse,
  PageThreadsResponse,
  PageWatchResponse,
  PageWatchScope,
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
  // Reactions (knowledge-reaction-routes.ts).
  'invalid_emoji',
  'reaction_needs_account',
  'reactions_full',
  'too_many_reactions',
  'reacting_too_fast',
  // Watching (knowledge-watch-routes.ts).
  'watch_needs_account',
  'not_a_section',
  'section_out_of_reach',
  'watchers_full',
  'watching_too_fast',
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

/** The page's reactions, oldest first. */
export async function apiPageReactions(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
): Promise<PageReaction[]> {
  const res = await apiFetch(pageUrl(documentId, tab, 'reactions'), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return (await expectOk<PageReactionsResponse>(res, 'read page reactions', expected)).reactions;
}

/** Add or take back the caller's own reaction. Answers the reaction and whether it moved. */
export async function apiChangePageReaction(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  change: PageReactionChange,
): Promise<PageReactionChangeResponse> {
  const res = await post(who, pageUrl(documentId, tab, 'reactions'), change);
  return expectOk<PageReactionChangeResponse>(res, 'react to page', expected);
}

/** Whether the caller watches the page (or a section above it), and how many do. */
export async function apiPageWatch(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
): Promise<PageWatchResponse> {
  const res = await apiFetch(pageUrl(documentId, tab, 'watch'), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return expectOk<PageWatchResponse>(res, 'read page watch', expected);
}

/** Watch the page, its section, or neither. Answers the page's watch as stored. */
export async function apiSetPageWatch(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  scope: PageWatchScope | null,
): Promise<PageWatchResponse> {
  const res = await apiFetch(pageUrl(documentId, tab, 'watch'), {
    method: 'PUT',
    headers: await knowledgeHeaders(who, true),
    body: JSON.stringify({ scope }),
    signal: knowledgeSignal(),
  });
  return expectOk<PageWatchResponse>(res, 'watch page', expected);
}
