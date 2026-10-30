// The owner's side of a document's Community post over plain fetch (liveworkspace/docs/specs/007-community/
// community.md "The Share dialog's Community tab"), for a host that reaches the document's app from another site (the
// Explorer on liveworkspace.app). An app's own editor keeps its own client, on its api transport.

import {
  communityServiceUrl,
  type CommunityApp,
  type CommunityFacetsResponse,
  type CommunityOwnPost,
  type CommunityOwnPostResponse,
  type CommunityPostInput,
} from '@liveworkspace/community';
import type { CommunityOwnerClient } from './host';

/** A refusal from the app: its status and, when it sent one, its code (`{ error: '<code>' }`). */
export class CommunityRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`community request failed (${status}${code ? ` ${code}` : ''})`);
    this.name = 'CommunityRequestError';
    this.status = status;
    this.code = code;
  }
}

async function refusal(res: Response): Promise<CommunityRequestError> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return new CommunityRequestError(res.status, typeof body?.error === 'string' ? body.error : null);
}

/** The most used tags in an app's Community, from the service's public facets; any failure is none. */
export async function communityPopularTags(
  app: CommunityApp,
  opts: { base?: string; fetch?: typeof fetch } = {},
): Promise<string[]> {
  const doFetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch(communityServiceUrl(app, '/facets', { base: opts.base }));
    if (!res.ok) return [];
    const { tags } = (await res.json()) as Partial<CommunityFacetsResponse>;
    return Array.isArray(tags) ? tags.map((t) => t.tag).filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function communityOwnerClient(opts: {
  app: CommunityApp;
  // The document's owner route (`https://www.livediagram.app/api/documents/<id>/community`).
  url: string;
  // The person's bearer token for the app, read per call.
  token: () => Promise<string | null>;
  // The service's address for the popular tags (its default when absent).
  serviceBase?: string;
  fetch?: typeof fetch;
}): CommunityOwnerClient {
  const doFetch =
    opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const call = async (method: string, body?: unknown): Promise<Response> => {
    const headers = new Headers();
    const token = await opts.token();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    return doFetch(opts.url, {
      method,
      headers,
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  return {
    get: async () => {
      const res = await call('GET');
      if (!res.ok) throw await refusal(res);
      const { post } = (await res.json()) as CommunityOwnPostResponse;
      return post ?? null;
    },
    publish: async (input: CommunityPostInput) => {
      const res = await call('PUT', input);
      if (!res.ok) throw await refusal(res);
      const { post } = (await res.json()) as { post: CommunityOwnPost };
      return post;
    },
    // Already gone (removed in another tab) counts as done.
    remove: async () => {
      const res = await call('DELETE');
      if (!res.ok && res.status !== 404) throw await refusal(res);
    },
    popularTags: () =>
      communityPopularTags(opts.app, { base: opts.serviceBase, fetch: opts.fetch }),
  };
}
