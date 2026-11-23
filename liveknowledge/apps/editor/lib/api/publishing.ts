// Publish to the Web (docs/specs/030-knowledgebase/publishing.md): the editor's three calls to
// /api/documents/<id>/publishing. Each answers the site as it now stands.
import type { PublishingRequest, PublishingState } from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

// The refusals the dialog words itself, so they are not reported as faults.
const EXPECTED = new Set([
  'forbidden',
  'needs_a_person',
  'sign_in_required',
  'publishing_unavailable',
  'invalid_address',
  'address_reserved',
  'address_taken',
  'invalid_root',
  'nothing_to_publish',
  'publish_limit_reached',
  'rate_limited',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

const url = (documentId: string, root?: string | null) =>
  knowledgeUrl(documentId, 'publishing') +
  (root === undefined ? '' : `?root=${encodeURIComponent(root ?? '')}`);

/** The site and a preview of what a publish of `root` (the site's own when left out) would show. */
export async function apiPublishingState(
  who: KnowledgeCaller,
  documentId: string,
  root?: string | null,
  signal?: AbortSignal,
): Promise<PublishingState> {
  const res = await apiFetch(url(documentId, root), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return expectOk<PublishingState>(res, 'read publishing', expected);
}

/** Publish, or change what is published. */
export async function apiPublish(
  who: KnowledgeCaller,
  documentId: string,
  request: PublishingRequest,
): Promise<PublishingState> {
  const res = await apiFetch(url(documentId), {
    method: 'PUT',
    headers: await knowledgeHeaders(who, true),
    body: JSON.stringify(request),
    signal: knowledgeSignal(),
  });
  return expectOk<PublishingState>(res, 'publish', expected);
}

/** Unpublish: the site comes down. */
export async function apiUnpublish(
  who: KnowledgeCaller,
  documentId: string,
): Promise<PublishingState> {
  const res = await apiFetch(url(documentId), {
    method: 'DELETE',
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(),
  });
  return expectOk<PublishingState>(res, 'unpublish', expected);
}
