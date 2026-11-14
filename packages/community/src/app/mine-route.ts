// `GET /api/community/mine`: My Shares (liveworkspace/docs/specs/007-community/community.md "App routes"). Every
// other Community read, and likes and reports, go from the page straight to the service. My Shares needs a signed-in
// author, and only the app's api can say who that is, so it asks the service for them. Personal, so never cached.

import { parseCommunityListQuery } from '../query';
import {
  communityKeyHeaders,
  communityOn,
  type CommunityAppClient,
  type CommunityAppEnv,
} from './client';
import type { CommunityResponses } from './owner-route';

export async function answerCommunityMine(req: {
  request: Request;
  env: CommunityAppEnv;
  service: CommunityAppClient;
  accountUserId: string | null;
  responses: Pick<CommunityResponses, 'json' | 'signInRequired'>;
}): Promise<Response> {
  const { request, env, service, responses: r } = req;
  if (!req.accountUserId) return r.signInRequired();
  const url = new URL(request.url);
  if (!parseCommunityListQuery(url.searchParams).ok) {
    return r.json({ error: 'invalid_query' }, { status: 400 });
  }
  const params = new URLSearchParams(url.searchParams);
  params.set('owner', req.accountUserId);
  const res = await service.call(env, `/mine?${params.toString()}`, {
    headers: communityKeyHeaders(request),
  });
  if (!res.ok) return r.json({ error: 'community_unavailable' }, { status: 502 });
  return new Response(res.body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

/** What `/api/community/<...>` reads of an app's request context. */
export type CommunityMineContext = {
  request: Request;
  env: CommunityAppEnv;
  segments: readonly string[];
  accountUserId?: string | null;
};

/**
 * An app's `/api/community/*` handler, built once at module scope from its service client and answers: switched off
 * (`communityOn`), there is no Community to answer for, and the one route under it is `GET /api/community/mine`.
 */
export function createCommunityMineRoute(deps: {
  service: CommunityAppClient;
  responses: Pick<CommunityResponses, 'json' | 'notFound' | 'signInRequired'>;
}): (ctx: CommunityMineContext) => Promise<Response> {
  const { service, responses } = deps;
  return async (ctx) => {
    const { request, env, segments } = ctx;
    if (!communityOn(env)) return responses.notFound();
    if (segments.length !== 3 || segments[2] !== 'mine' || request.method !== 'GET') {
      return responses.notFound();
    }
    return answerCommunityMine({
      request,
      env,
      service,
      accountUserId: ctx.accountUserId ?? null,
      responses,
    });
  };
}
