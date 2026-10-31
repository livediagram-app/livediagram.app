import { readErrorCode } from '@liveworkspace/api-schema/http-errors';
import {
  COMMUNITY_API_URL,
  COMMUNITY_KEY_HEADER,
  communityServiceUrl,
  communityQueryParams,
  type CommunityApp,
  type CommunityFacetsResponse,
  type CommunityLikeResponse,
  type CommunityListQuery,
  type CommunityListResponse,
  type CommunityMineResponse,
  type CommunityPostResponse,
  type CommunityReportInput,
} from '@liveworkspace/community';
import { workspaceOriginFor } from '@liveworkspace/sites';
import { getCommunityKey } from './community-key';

// The Community pages' api client (liveworkspace/docs/specs/007-community/community.md "The API"), typed with the
// shared contract. The gallery, posts, likes and reports are the liveworkspace Community service's, asked for this
// app's posts only; My Shares is the app's own api, which alone knows who is signed in. Every request carries the
// community key so lists and posts come back with `liked` filled in. Only My Shares sends a session token.

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

/** What createCommunityApi needs from the app's binding. */
export type CommunityApiSite = {
  app: CommunityApp;
  apiBase: string;
  communityApi?: string;
  keyStorage: string;
};

export type CommunityApi = {
  fetchPosts: (query: CommunityListQuery, signal?: AbortSignal) => Promise<CommunityListResponse>;
  fetchMine: (
    query: CommunityListQuery,
    token: string,
    signal?: AbortSignal,
  ) => Promise<CommunityMineResponse>;
  fetchFacets: (signal?: AbortSignal) => Promise<CommunityFacetsResponse>;
  /** A missing, hidden or trashed post answers null, which the post page shows as not-found. */
  fetchPost: (id: string, signal?: AbortSignal) => Promise<CommunityPostResponse | null>;
  likePost: (id: string) => Promise<CommunityLikeResponse>;
  unlikePost: (id: string) => Promise<CommunityLikeResponse>;
  /** Resolves on 204, also for a repeat report from this browser. */
  reportPost: (id: string, input: CommunityReportInput) => Promise<void>;
};

// Where the posts live: the liveworkspace Community service, which keeps every app's posts, likes and reports. The
// build can name one (a `wrangler dev` on port 8791); else it is liveworkspace.app's as seen from this page
// (@liveworkspace/sites workspaceOriginFor): production's, staging's from a staging app, and the local site's on a dev
// server, which forwards it. Production's outside a browser.
export function communityApiBase(named: string | undefined): string {
  if (named) return named;
  if (typeof window === 'undefined') return COMMUNITY_API_URL;
  return `${workspaceOriginFor(window.location.host)}/api/community`;
}

const postPath = (id: string) => `/posts/${encodeURIComponent(id)}`;

export function createCommunityApi(site: CommunityApiSite): CommunityApi {
  function headers(extra?: Record<string, string>): Record<string, string> {
    const key = getCommunityKey(site.keyStorage);
    return {
      Accept: 'application/json',
      ...(key ? { [COMMUNITY_KEY_HEADER]: key } : {}),
      ...extra,
    };
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
    communityServiceUrl(site.app, path, { base: communityApiBase(site.communityApi), search });

  return {
    fetchPosts: (query, signal) =>
      json(service('/posts', communityQueryParams(query).toString()), { signal }),
    // My Shares: the signed-in author's own posts under the same search words, with their totals.
    fetchMine: (query, token, signal) => {
      const search = communityQueryParams(query).toString();
      return json(`${site.apiBase}/community/mine${search ? `?${search}` : ''}`, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    fetchFacets: (signal) => json(service('/facets'), { signal }),
    fetchPost: async (id, signal) => {
      try {
        return await json<CommunityPostResponse>(service(postPath(id)), { signal });
      } catch (err) {
        if (err instanceof CommunityApiError && err.status === 404) return null;
        throw err;
      }
    },
    likePost: (id) => json(service(`${postPath(id)}/like`), { method: 'PUT' }),
    unlikePost: (id) => json(service(`${postPath(id)}/like`), { method: 'DELETE' }),
    reportPost: async (id, input) => {
      await request(service(`${postPath(id)}/report`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
  };
}
