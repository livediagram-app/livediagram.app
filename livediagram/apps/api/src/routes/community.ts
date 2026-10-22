// /api/community/mine: My Shares (docs/specs/025-community/community.md "My Shares"). Every other Community read, and
// likes and reports, go from the page straight to the liveworkspace Community service (liveworkspace/docs/
// community.md), which keeps the posts. My Shares needs a signed-in author, and only this api can say who that is, so
// it asks the service for them. Personal, so never cached.

import { parseCommunityListQuery } from '@livediagram/api-schema';
import { communityEnabled } from '../community-enabled';
import {
  communityKeyHeaders,
  communityService,
  communityServiceConfigured,
} from '../community-service';
import { json, notFound, signInRequired } from '../responses';
import type { RouteContext } from './context';

export async function handleCommunity(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, url } = ctx;
  // Switched off, there is no Community to answer for.
  if (!communityEnabled(env) || !communityServiceConfigured(env)) return notFound();
  if (segments.length !== 3 || segments[2] !== 'mine' || request.method !== 'GET')
    return notFound();
  if (!ctx.clerkUserId) return signInRequired();
  if (!parseCommunityListQuery(url.searchParams).ok) {
    return json({ error: 'invalid_query' }, { status: 400 });
  }
  const params = new URLSearchParams(url.searchParams);
  params.set('owner', ctx.clerkUserId);
  const res = await communityService(env, `/mine?${params.toString()}`, {
    headers: communityKeyHeaders(request),
  });
  if (!res.ok) return json({ error: 'community_unavailable' }, { status: 502 });
  return new Response(res.body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
