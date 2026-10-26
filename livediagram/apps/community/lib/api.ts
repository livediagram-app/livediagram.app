import {
  COMMUNITY_KEY_HEADER,
  communityServiceUrl,
  communityImagePath,
  communityQueryParams,
  type CommunityFacetsResponse,
  type CommunityLikeResponse,
  type CommunityListQuery,
  type CommunityListResponse,
  type CommunityMineResponse,
  type CommunityPostResponse,
  type CommunityReportInput,
  readErrorCode,
} from '@livediagram/api-schema';
import { getCommunityKey } from './community-key';
import { API_BASE, communityApi } from './config';

// The Community app's api client (blueprint §4 routes, §5 "Community app"), typed with the shared
// api-schema DTOs. The gallery, posts, likes and reports are the liveworkspace Community service's
// (liveworkspace/docs/specs/007-community/community.md), asked for this app's posts only; My Shares is this app's api, which
// alone knows who is signed in. Every request carries the community key so lists and posts come back
// with `liked` filled in. Only My Shares sends a session token
// (blueprint §7).

export class CommunityApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null) {
    super(`[community] api ${status}${code ? ` ${code}` : ''}`);
    this.name = 'CommunityApiError';
    this.status = status;
    this.code = code;
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const key = getCommunityKey();
  return { Accept: 'application/json', ...(key ? { [COMMUNITY_KEY_HEADER]: key } : {}), ...extra };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: headers(init.headers as Record<string, string> | undefined),
  });
  if (!res.ok) throw new CommunityApiError(res.status, await readErrorCode(res));
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await request(path, init)).json()) as T;
}

// A path on the Community service, for this app's posts. `search` is the rest of the query.
const service = (path: string, search?: string) =>
  communityServiceUrl('livediagram.app', path, { base: communityApi(), search });

const postPath = (id: string) => `/posts/${encodeURIComponent(id)}`;

export function fetchPosts(
  query: CommunityListQuery,
  signal?: AbortSignal,
): Promise<CommunityListResponse> {
  return json(service('/posts', communityQueryParams(query).toString()), { signal });
}

// My Shares: the signed-in author's own posts under the same search words, with their totals.
export function fetchMine(
  query: CommunityListQuery,
  token: string,
  signal?: AbortSignal,
): Promise<CommunityMineResponse> {
  const search = communityQueryParams(query).toString();
  return json(`${API_BASE}/community/mine${search ? `?${search}` : ''}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchFacets(signal?: AbortSignal): Promise<CommunityFacetsResponse> {
  return json(service('/facets'), { signal });
}

// A missing, hidden or trashed post answers 404, which the post page shows as not-found.
export async function fetchPost(
  id: string,
  signal?: AbortSignal,
): Promise<CommunityPostResponse | null> {
  try {
    return await json<CommunityPostResponse>(service(postPath(id)), { signal });
  } catch (err) {
    if (err instanceof CommunityApiError && err.status === 404) return null;
    throw err;
  }
}

export function likePost(id: string): Promise<CommunityLikeResponse> {
  return json(service(`${postPath(id)}/like`), { method: 'PUT' });
}

export function unlikePost(id: string): Promise<CommunityLikeResponse> {
  return json(service(`${postPath(id)}/like`), { method: 'DELETE' });
}

// 204 on success, also for a repeat report from this browser.
export async function reportPost(id: string, input: CommunityReportInput): Promise<void> {
  await request(service(`${postPath(id)}/report`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// The post's live card image, rendered by the api from the document's latest snapshot.
export function postImageUrl(shareCode: string): string {
  return `${API_BASE}${communityImagePath(shareCode)}`;
}
