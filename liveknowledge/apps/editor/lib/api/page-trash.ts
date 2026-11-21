// The knowledgebase's page Trash from the editor (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// Trash"): list it, restore a page, delete one forever, empty it. Each is one request through the shared funnel;
// the api decides who may (a writer lists and restores, an Editor deletes forever and empties).
import type {
  PageRestoreResponse,
  PageTrashResponse,
  TrashedPage,
} from '@liveknowledge/api-schema';
import { apiFetch, expectOk, expectOkVoid } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

// The refusals the interface words itself, so they are not reported as faults.
const EXPECTED = new Set(['forbidden', 'not_in_trash', 'page_limit', 'trash_is_a_persons']);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

const trashUrl = (documentId: string, path = '') =>
  knowledgeUrl(documentId, path ? `trash/${path}` : 'trash');

/** The Trash, newest first. */
export async function apiPageTrash(
  who: KnowledgeCaller,
  documentId: string,
  signal?: AbortSignal,
): Promise<TrashedPage[]> {
  const res = await apiFetch(trashUrl(documentId), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return (await expectOk<PageTrashResponse>(res, 'read page trash', expected)).pages;
}

/** Put a page and its trashed subpages back. Throws `page_limit` (409) past 500 pages. */
export async function apiRestorePage(
  who: KnowledgeCaller,
  documentId: string,
  page: string,
): Promise<PageRestoreResponse> {
  const res = await apiFetch(trashUrl(documentId, `${encodeURIComponent(page)}/restore`), {
    method: 'POST',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOk<PageRestoreResponse>(res, 'restore page', expected);
}

/** Remove a page in the Trash, and its trashed subpages, for good. */
export async function apiDeletePageForever(
  who: KnowledgeCaller,
  documentId: string,
  page: string,
): Promise<void> {
  const res = await apiFetch(trashUrl(documentId, encodeURIComponent(page)), {
    method: 'DELETE',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOkVoid(res, 'delete page forever');
}

/** Remove every page in the Trash for good. */
export async function apiEmptyPageTrash(who: KnowledgeCaller, documentId: string): Promise<void> {
  const res = await apiFetch(trashUrl(documentId), {
    method: 'DELETE',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOkVoid(res, 'empty page trash');
}
