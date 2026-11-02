// /api/community/mine: My Shares (docs/specs/025-community/community.md "My Shares"). Every other Community read, and
// likes and reports, go from the page straight to the liveworkspace Community service (liveworkspace/docs/
// community.md), which keeps the posts. My Shares needs a signed-in author, and only this api can say who that is, so
// it asks the service for them (@liveworkspace/community/app mine-route.ts). Personal, so never cached.

import { answerCommunityMine, communityAppClient, communityOn } from '@liveworkspace/community/app';
import { COMMUNITY_APP } from '../community-service';
import { json, notFound, signInRequired } from '../responses';
import type { RouteContext } from './context';

const service = communityAppClient(COMMUNITY_APP);

export async function handleCommunity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  // Switched off, there is no Community to answer for.
  if (!communityOn(env)) return notFound();
  if (segments.length !== 3 || segments[2] !== 'mine' || request.method !== 'GET')
    return notFound();
  return answerCommunityMine({
    request,
    env,
    service,
    accountUserId: ctx.accountUserId ?? null,
    responses: { json, signInRequired },
  });
}
