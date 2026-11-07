// Community calls from the editor (docs/specs/025-community/community.md; blueprint
// docs/specs/025-community/community.md): the owner's post on a plan (read,
// publish / Edit Listing, remove). The public gallery reads live in
// liveworkspace.app's Community page; nothing here is called without an owner identity.
import {
  communityServiceUrl,
  type CommunityFacetsResponse,
  type CommunityOwnPost,
  type CommunityOwnPostResponse,
  type CommunityPostInput,
} from '@liveplanner/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

function projectCommunityUrl(projectId: string): string {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/community`;
}

// The owner's post on this plan, or null when it isn't published. Throws ApiError on a 403 / 404
// (not the owner, no such plan), which the Share dialog shows as an unavailable section.
export async function apiGetCommunityPost(
  ownerId: string,
  projectId: string,
): Promise<CommunityOwnPost | null> {
  const res = await apiFetch(projectCommunityUrl(projectId), {
    headers: await apiHeaders(ownerId),
  });
  const { post } = await expectOk<CommunityOwnPostResponse>(res, 'load community post');
  return post ?? null;
}

// Publish the plan, or update its listing when it is already published (Edit Listing: the same
// PUT). A refusal throws ApiError carrying the worker's code (`sign_in_required`, `team_document`,
// `share_password_set`, `empty_document`, `post_limit`, `invalid_<field>`); see
// communityErrorMessage for the words each one shows.
export async function apiPublishCommunityPost(
  ownerId: string,
  projectId: string,
  input: CommunityPostInput,
): Promise<CommunityOwnPost> {
  const res = await apiFetch(projectCommunityUrl(projectId), {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  const { post } = await expectOk<{ post: CommunityOwnPost }>(res, 'publish community post');
  return post;
}

// Remove From Community. A 404 (already removed, in another tab) counts as done.
export async function apiRemoveCommunityPost(ownerId: string, projectId: string): Promise<void> {
  return apiDelete(projectCommunityUrl(projectId), ownerId, {
    action: 'remove community post',
  });
}

// The most used tags, offered as suggestions in the publish dialog: this app's, from the liveworkspace
// Community service (liveworkspace/docs/specs/007-community/community.md). The facets read is public, so it goes out with no
// identity at all; any failure is just no suggestions.
export async function apiCommunityPopularTags(): Promise<string[]> {
  try {
    const res = await apiFetch(
      communityServiceUrl('liveplanner.app', '/facets', {
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
