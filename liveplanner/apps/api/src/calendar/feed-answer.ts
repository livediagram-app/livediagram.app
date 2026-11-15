// How a calendar feed's link answers (docs/specs/026-plan/calendar-feed.md "How it answers"; blueprint calendar-feed.md
// "Behaviour and state"), a plan's feed and the My Work feed alike: the calendar with a short private cache, an ETag
// and a 304, or one of a few refusals, every "no" the same 404 so a link says nothing about why it stopped.

import { json } from '../responses';
import type { Env } from '../types';
import type { FeedRead } from './feed-events';
import { writeCalendar } from './ics';

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

export type FeedRefusal =
  | 'malformed'
  | 'method'
  | 'rate_limited'
  | 'unknown_token'
  | 'no_access'
  | 'unavailable'
  | 'no_plan';

/** The refusal's answer, logged by its reason (never the token). */
export function refuseFeed(reason: FeedRefusal): Response {
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

/** The method and the feed's own rate, before anything is read: a refusal, or null to go on. Per feed, never per
 *  network: Google and Microsoft fetch every subscriber's feed from a few addresses. */
export async function feedGate(
  request: Request,
  limiter: Env['WRITE_RATE_LIMITER'],
  tokenHash: string,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return refuseFeed('method');
  if (limiter) {
    const ok = await limiter.limit({ key: `feed:${tokenHash.slice(0, 32)}` });
    if (!ok.success) return refuseFeed('rate_limited');
  }
  return null;
}

// The body's ETag: the first 128 bits of its SHA-256, quoted.
async function etagOf(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.slice(0, 32)}"`;
}

/** Whether an If-None-Match names this ETag (strong or weak form), or is `*`. */
export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .some((t) => t === '*' || t === etag);
}

/** The calendar, or 304 when the fetch already holds it. `HEAD` answers the headers alone. */
export async function answerFeed(
  request: Request,
  read: FeedRead,
  filename: string,
): Promise<Response> {
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
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
