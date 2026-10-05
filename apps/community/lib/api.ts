import {
  COMMUNITY_KEY_HEADER,
  communityImagePath,
  communityQueryParams,
  type CommunityFacetsResponse,
  type CommunityLikeResponse,
  type CommunityListQuery,
  type CommunityListResponse,
  type CommunityPostResponse,
  type CommunityReportInput,
} from '@livediagram/api-schema';
import { getCommunityKey } from './community-key';
import { API_BASE } from './config';

// The Community app's api client (blueprint §4 routes, §5 "Community app"), typed with the shared
// api-schema DTOs. Every request carries the community key so lists and posts come back with `liked`
// filled in; nothing here ever sends `X-Owner-Id` or a session token (blueprint §7).

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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: headers(init.headers as Record<string, string> | undefined),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new CommunityApiError(res.status, typeof body?.error === 'string' ? body.error : null);
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await request(path, init)).json()) as T;
}

const postPath = (id: string) => `/community/posts/${encodeURIComponent(id)}`;

export function fetchPosts(
  query: CommunityListQuery,
  signal?: AbortSignal,
): Promise<CommunityListResponse> {
  const search = communityQueryParams(query).toString();
  return json(`/community/posts${search ? `?${search}` : ''}`, { signal });
}

export function fetchFacets(signal?: AbortSignal): Promise<CommunityFacetsResponse> {
  return json('/community/facets', { signal });
}

// A missing, hidden or trashed post answers 404, which the post page shows as not-found.
export async function fetchPost(
  id: string,
  signal?: AbortSignal,
): Promise<CommunityPostResponse | null> {
  try {
    return await json<CommunityPostResponse>(postPath(id), { signal });
  } catch (err) {
    if (err instanceof CommunityApiError && err.status === 404) return null;
    throw err;
  }
}

export function likePost(id: string): Promise<CommunityLikeResponse> {
  return json(`${postPath(id)}/like`, { method: 'PUT' });
}

export function unlikePost(id: string): Promise<CommunityLikeResponse> {
  return json(`${postPath(id)}/like`, { method: 'DELETE' });
}

// 204 on success, also for a repeat report from this browser.
export async function reportPost(id: string, input: CommunityReportInput): Promise<void> {
  await request(`${postPath(id)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// The post's live card image, rendered by the api from the document's latest snapshot.
export function postImageUrl(shareCode: string): string {
  return `${API_BASE}${communityImagePath(shareCode)}`;
}
