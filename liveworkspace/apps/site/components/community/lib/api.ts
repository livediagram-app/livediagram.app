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
  type CommunityScope,
} from '@liveworkspace/community';
import { workspaceOriginFor } from '@liveworkspace/sites';
import { getCommunityKey } from './community-key';

// The Community page's api client (liveworkspace/docs/specs/007-community/community.md "The API"), typed with the
// shared contract. The gallery, posts, likes and reports are the liveworkspace Community service's: the gallery asks
// for the page's scope (one app's posts, or every app's), and a post, its like and its report name the post's own app.
// My Shares is the app's own api on its address, which alone knows who is signed in. Every request carries the
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

/** What createCommunityApi needs from the page's binding. */
export type CommunityApiSite = {
  // Whose posts the gallery lists: one app's, or every app's (`all`).
  scope: CommunityScope;
  // The app whose address the page is on (its post page, its My Shares), or null on liveworkspace.app.
  pageApp: CommunityApp | null;
  communityApi?: string;
  keyStorage: string;
};

// The app's own api on its address (My Shares): the router stitches it under `/api`.
const APP_API = '/api';

export type CommunityApi = {
  fetchPosts: (query: CommunityListQuery, signal?: AbortSignal) => Promise<CommunityListResponse>;
  fetchMine: (
    query: CommunityListQuery,
    token: string,
    signal?: AbortSignal,
  ) => Promise<CommunityMineResponse>;
  fetchFacets: (signal?: AbortSignal) => Promise<CommunityFacetsResponse>;
  /** One of the page's app's posts. A missing, hidden or trashed post answers null, which the post page shows as
   *  not-found; so does any post on liveworkspace.app, where no app's post page is. */
  fetchPost: (id: string, signal?: AbortSignal) => Promise<CommunityPostResponse | null>;
  likePost: (id: string, app: CommunityApp) => Promise<CommunityLikeResponse>;
  unlikePost: (id: string, app: CommunityApp) => Promise<CommunityLikeResponse>;
  /** Resolves on 204, also for a repeat report from this browser. */
  reportPost: (id: string, app: CommunityApp, input: CommunityReportInput) => Promise<void>;
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

  // A path on the Community service, for `app`'s posts (or every app's). `search` is the rest of the query.
  const service = (app: CommunityScope, path: string, search?: string) =>
    communityServiceUrl(app, path, { base: communityApiBase(site.communityApi), search });

  return {
    fetchPosts: (query, signal) =>
      json(service(site.scope, '/posts', communityQueryParams(query).toString()), { signal }),
    // My Shares: the signed-in author's own posts under the same search words, with their totals.
    fetchMine: (query, token, signal) => {
      const search = communityQueryParams(query).toString();
      return json(`${APP_API}/community/mine${search ? `?${search}` : ''}`, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    fetchFacets: (signal) => json(service(site.scope, '/facets'), { signal }),
    fetchPost: async (id, signal) => {
      if (!site.pageApp) return null;
      try {
        return await json<CommunityPostResponse>(service(site.pageApp, postPath(id)), { signal });
      } catch (err) {
        if (err instanceof CommunityApiError && err.status === 404) return null;
        throw err;
      }
    },
    likePost: (id, app) => json(service(app, `${postPath(id)}/like`), { method: 'PUT' }),
    unlikePost: (id, app) => json(service(app, `${postPath(id)}/like`), { method: 'DELETE' }),
    reportPost: async (id, app, input) => {
      await request(service(app, `${postPath(id)}/report`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
  };
}
