// A calendar feed's link (docs/specs/026-plan/calendar-feed.md "How it answers"; blueprint calendar-feed.md
// "Behaviour and state").
//
// `GET /api/calendar/:projectId/lpf_<token>.ics`: what Google Calendar, Outlook or Apple Calendar polls. The worker
// answers it before identity (index.ts): the feed token is the whole proof, and the route never reads an
// Authorization header. In order: the link's shape (404), the method (405), the feed's own rate (429), the token's
// feed in the plan's room (404), the person's access asked fresh of accounts and the index (404, or 503 when they
// cannot say), the plan's cards (404 for a plan gone), then the calendar, with a short cache, an ETag and a 304.
// Every refusal answers the same 404, so a link says nothing about why it stopped. The token is never logged.

import type { CalendarFeed } from '../calendar/feed-store';
import { calendarFeedAccess } from '../calendar/feed-access';
import type { FeedRead } from '../calendar/feed-events';
import { feedTokenHash } from '../calendar/feed-token';
import { writeCalendar } from '../calendar/ics';
import { planRoom } from '../plan-client';
import { json } from '../responses';
import type { Env } from '../types';

// A plan's id as the app makes them, and the token's shape (feed-token.ts FEED_TOKEN_PATTERN).
const FEED_LINK = /^\/api\/calendar\/([A-Za-z0-9_-]{1,200})\/(lpf_[A-Za-z0-9_-]{43})\.ics$/;

// The access check is never older than this when a calendar app keeps the answer.
export const FEED_MAX_AGE_S = 300;

// When accounts or the index cannot be asked, calendar apps come back after this.
const UNAVAILABLE_RETRY_S = 300;

const NO_STORE = { 'Cache-Control': 'no-store' };

const FEED_HEADERS = {
  'Cache-Control': `private, max-age=${FEED_MAX_AGE_S}`,
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
};

type Refusal =
  | 'malformed'
  | 'method'
  | 'rate_limited'
  | 'unknown_token'
  | 'no_access'
  | 'unavailable'
  | 'no_plan';

function refuse(reason: Refusal): Response {
  console.info('[calendar-feed] refused', { reason });
  if (reason === 'method')
    return json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { ...NO_STORE, Allow: 'GET, HEAD' } },
    );
  if (reason === 'rate_limited')
    return json(
      { error: 'rate_limited' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } },
    );
  if (reason === 'unavailable')
    return json(
      { error: 'feed_unavailable' },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': String(UNAVAILABLE_RETRY_S) } },
    );
  return json({ error: 'feed_not_found' }, { status: 404, headers: NO_STORE });
}

// The body's ETag: the first 128 bits of its SHA-256, quoted.
async function etagOf(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.slice(0, 32)}"`;
}

// Whether an If-None-Match names this ETag (strong or weak form), or is `*`.
export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .some((t) => t === '*' || t === etag);
}

/** `/api/calendar/:projectId/:token.ics`: the person's calendar feed of the plan's card dates, or the refusal. */
export async function handleCalendarFeed(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const link = FEED_LINK.exec(new URL(request.url).pathname);
  if (!link) return refuse('malformed');
  const [, projectId = '', token = ''] = link;
  if (request.method !== 'GET' && request.method !== 'HEAD') return refuse('method');
  const tokenHash = await feedTokenHash(token);
  // Per feed, never per network: Google and Microsoft fetch every subscriber's feed from a few addresses.
  if (env.WRITE_RATE_LIMITER) {
    const ok = await env.WRITE_RATE_LIMITER.limit({ key: `feed:${tokenHash.slice(0, 32)}` });
    if (!ok.success) return refuse('rate_limited');
  }
  const room = planRoom(env, projectId);
  const feed: CalendarFeed | null = await room.calendarFeed(tokenHash);
  if (!feed) return refuse('unknown_token');
  const access = await calendarFeedAccess(env, projectId, feed.personId);
  if (access !== 'ok') return refuse(access === 'refused' ? 'no_access' : 'unavailable');
  const read: FeedRead | null = await room.calendarFeedEvents(feed, now);
  if (!read) return refuse('no_plan');
  const body = writeCalendar(read);
  const etag = await etagOf(body);
  const notModified = matchesEtag(request.headers.get('If-None-Match'), etag);
  console.info('[calendar-feed] served', {
    events: read.events.length,
    truncated: read.truncated,
    notModified,
  });
  if (notModified)
    return new Response(null, { status: 304, headers: { ...FEED_HEADERS, ETag: etag } });
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      ...FEED_HEADERS,
      ETag: etag,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="plan.ics"',
    },
  });
}
