// `GET /api/community/mine`: My Shares (liveworkspace/docs/specs/007-community/community.md "App routes"). Every
// other Community read, and likes and reports, go from the page straight to the service. My Shares needs a signed-in
// author, and only the app's api can say who that is, so it asks the service for them. Personal, so never cached.

import { parseCommunityListQuery } from '../query';
import { communityKeyHeaders, type CommunityAppClient, type CommunityAppEnv } from './client';
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
