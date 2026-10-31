// Community calls from the editor (docs/specs/025-community/community.md "Publishing"): the owner's post on a design (read,
// publish / Edit Listing, remove). The public gallery reads live in
// apps/community; nothing here is called without an owner identity.
import {
  communityServiceUrl,
  type CommunityFacetsResponse,
  type CommunityOwnPost,
  type CommunityOwnPostResponse,
  type CommunityPostInput,
} from '@livedesign/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

function designCommunityUrl(designId: string): string {
  return `${API_BASE}/designs/${encodeURIComponent(designId)}/community`;
}

// The owner's post on this design, or null when it isn't published. Throws ApiError on a 403 / 404
// (not the owner, no such design), which the Share dialog shows as an unavailable section.
export async function apiGetCommunityPost(
  ownerId: string,
  designId: string,
): Promise<CommunityOwnPost | null> {
  const res = await apiFetch(designCommunityUrl(designId), {
    headers: await apiHeaders(ownerId),
  });
  const { post } = await expectOk<CommunityOwnPostResponse>(res, 'load community post');
  return post ?? null;
}

// Publish the design, or update its listing when it is already published (Edit Listing: the same
// PUT). A refusal throws ApiError carrying the worker's code (signed out, a team design, a share password set, an
// empty first page, the post limit, an invalid field); communityErrorMessage words each one.
export async function apiPublishCommunityPost(
  ownerId: string,
  designId: string,
  input: CommunityPostInput,
): Promise<CommunityOwnPost> {
  const res = await apiFetch(designCommunityUrl(designId), {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  const { post } = await expectOk<{ post: CommunityOwnPost }>(res, 'publish community post');
  return post;
}

// Remove From Community. A 404 (already removed, in another tab) counts as done.
export async function apiRemoveCommunityPost(ownerId: string, designId: string): Promise<void> {
  return apiDelete(designCommunityUrl(designId), ownerId, {
    action: 'remove community post',
  });
}

// The most used tags, offered as suggestions in the publish dialog: this app's, from the liveworkspace
// Community service (liveworkspace/docs/specs/007-community/community.md). The facets read is public, so it goes out with no
// identity at all; any failure is just no suggestions.
export async function apiCommunityPopularTags(): Promise<string[]> {
  try {
    const res = await apiFetch(
      communityServiceUrl('livedesign.app', '/facets', {
        base: process.env.NEXT_PUBLIC_COMMUNITY_API,
      }),
    );
    if (!res.ok) return [];
    const { tags } = (await res.json()) as Partial<CommunityFacetsResponse>;
    return Array.isArray(tags) ? tags.map((t) => t.tag).filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}
