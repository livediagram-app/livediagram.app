// GET /api/unfurl?url=<encoded> — server-side link "unfurl" for the link-card
// element (docs/specs/009-elements/link-cards.md). The fetch, its SSRF guard and its bounds are @liveworkspace/api-kit's
// (unfurl.ts, unfurl-fetch.ts); this route keeps the routing, the per-IP throttle and this product's User-Agent.
// Always returns 200 with at least the resolved url (the card falls back to the bare URL on a miss).

import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { parsePublicHttpUrl } from '@liveworkspace/api-kit/unfurl';
import { unfurl } from '@liveworkspace/api-kit/unfurl-fetch';
import { badRequest, json, notFound, rateLimited } from '../responses';
import type { RouteContext } from './context';

const USER_AGENT = 'livehuddle-unfurl/1.0 (+https://www.livehuddle.app)';

export async function handleUnfurl(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments } = ctx;
  if (segments.length !== 2 || request.method !== 'GET') return notFound();

  // Per-IP throttle: it's an unauthenticated outbound fetch, so bound abuse.
  if (env.UNFURL_RATE_LIMITER) {
    const ip = clientRateKey(request);
    if (!(await env.UNFURL_RATE_LIMITER.limit({ key: ip })).success) return rateLimited();
  }

  const target = url.searchParams.get('url');
  if (!target) return badRequest('missing url');
  const parsed = parsePublicHttpUrl(target);
  if (!parsed) return badRequest('invalid or disallowed url');

  const outcome = await unfurl(parsed, USER_AGENT);
  if ('disallowed' in outcome) return badRequest('redirected to a disallowed url');
  return json(outcome.result);
}
