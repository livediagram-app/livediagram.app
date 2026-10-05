// Community calls from the editor (docs/specs/025-community/community.md; blueprint
// docs/specs/025-community/blueprints/community.md §4): the owner's post on a document (read,
// publish / Edit Listing, remove). The public gallery reads live in
// apps/community; nothing here is called without an owner identity.
import type {
  CommunityFacetsResponse,
  CommunityOwnPost,
  CommunityOwnPostResponse,
  CommunityPostInput,
} from '@livediagram/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

function documentCommunityUrl(documentId: string): string {
  return `${API_BASE}/documents/${encodeURIComponent(documentId)}/community`;
}

// The owner's post on this document, or null when it isn't published. Throws ApiError on a 403 / 404
// (not the owner, no such document), which the Share dialog shows as an unavailable section.
export async function apiGetCommunityPost(
  ownerId: string,
  documentId: string,
): Promise<CommunityOwnPost | null> {
  const res = await apiFetch(documentCommunityUrl(documentId), {
    headers: await apiHeaders(ownerId),
  });
  const { post } = await expectOk<CommunityOwnPostResponse>(res, 'load community post');
  return post ?? null;
}

// Publish the document, or update its listing when it is already published (Edit Listing: the same
// PUT). A refusal throws ApiError carrying the worker's code (`sign_in_required`, `team_document`,
// `share_password_set`, `empty_document`, `post_limit`, `invalid_<field>`); see
// communityErrorMessage for the words each one shows.
export async function apiPublishCommunityPost(
  ownerId: string,
  documentId: string,
  input: CommunityPostInput,
): Promise<CommunityOwnPost> {
  const res = await apiFetch(documentCommunityUrl(documentId), {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  const { post } = await expectOk<{ post: CommunityOwnPost }>(res, 'publish community post');
  return post;
}

// Remove From Community. A 404 (already removed, in another tab) counts as done.
export async function apiRemoveCommunityPost(ownerId: string, documentId: string): Promise<void> {
  return apiDelete(documentCommunityUrl(documentId), ownerId, {
    action: 'remove community post',
  });
}

// The most used tags, offered as suggestions in the publish dialog. The facets read is public, so it
// goes out with no identity at all; any failure is just no suggestions.
export async function apiCommunityPopularTags(): Promise<string[]> {
  try {
    const res = await apiFetch(`${API_BASE}/community/facets`);
    if (!res.ok) return [];
    const { tags } = (await res.json()) as Partial<CommunityFacetsResponse>;
    return Array.isArray(tags) ? tags.map((t) => t.tag).filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}
