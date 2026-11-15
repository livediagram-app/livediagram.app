// A calendar feed's link (docs/specs/026-plan/calendar-feed.md "How it answers"; blueprint calendar-feed.md
// "Behaviour and state").
//
// `GET /api/calendar/:projectId/lpf_<token>.ics`: what Google Calendar, Outlook or Apple Calendar polls. The worker
// answers it before identity (index.ts): the feed token is the whole proof, and the route never reads an
// Authorization header. In order: the link's shape (404), the method (405), the feed's own rate (429), the token's
// feed in the plan's room (404), the person's access asked fresh of accounts and the index (404, or 503 when they
// cannot say), the plan's cards (404 for a plan gone), then the calendar, with a short cache, an ETag and a 304.
// Every refusal answers the same 404, so a link says nothing about why it stopped. The token is never logged.
// `/api/calendar/my-work/lpf_<token>.ics` is the My Work feed (my-work-feed-route.ts).

import type { CalendarFeed } from '../calendar/feed-store';
import { calendarFeedAccess } from '../calendar/feed-access';
import { answerFeed, feedGate, refuseFeed } from '../calendar/feed-answer';
import type { FeedRead } from '../calendar/feed-events';
import { feedTokenHash } from '../calendar/feed-token';
import { planRoom } from '../plan-client';
import type { Env } from '../types';
import { handleMyWorkFeed, MY_WORK_FEED_SEGMENT } from './my-work-feed-route';

export { FEED_MAX_AGE_S, matchesEtag } from '../calendar/feed-answer';

// A plan's id as the app makes them, and the token's shape (feed-token.ts FEED_TOKEN_PATTERN).
const FEED_LINK = /^\/api\/calendar\/([A-Za-z0-9_-]{1,200})\/(lpf_[A-Za-z0-9_-]{43})\.ics$/;

/** `/api/calendar/:projectId/:token.ics`: the person's calendar feed of the plan's card dates, or the refusal. */
export async function handleCalendarFeed(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<Response> {
  const link = FEED_LINK.exec(new URL(request.url).pathname);
  if (!link) return refuseFeed('malformed');
  const [, projectId = '', token = ''] = link;
  // Plan ids are UUIDs, so this word is never one.
  if (projectId === MY_WORK_FEED_SEGMENT) return handleMyWorkFeed(request, env, token, now);
  const tokenHash = await feedTokenHash(token);
  const gate = await feedGate(request, env.WRITE_RATE_LIMITER, tokenHash);
  if (gate) return gate;
  const room = planRoom(env, projectId);
  const feed: CalendarFeed | null = await room.calendarFeed(tokenHash);
  if (!feed) return refuseFeed('unknown_token');
  const access = await calendarFeedAccess(env, projectId, feed.personId);
  if (access !== 'ok') return refuseFeed(access === 'refused' ? 'no_access' : 'unavailable');
  const read: FeedRead | null = await room.calendarFeedEvents(feed, now);
  if (!read) return refuseFeed('no_plan');
  return answerFeed(request, read, 'plan.ics');
}
