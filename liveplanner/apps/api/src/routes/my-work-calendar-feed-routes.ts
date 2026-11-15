// A person's own My Work feed, `/api/my-work/calendar-feed` (docs/specs/026-plan/calendar-feed.md "The My Work feed",
// "Managing it"; blueprint calendar-feed.md "Part 3"). Signed in, in person: never an API token, a workbench session
// or a guest (403 `calendar_feed_needs_account`). The feed's token hash is kept at liveworkspace's index, beside the
// cards it lists; the token itself leaves this api once, in POST's answer.
//
//   GET    whether the person has one and when its link was made (never the link)
//   POST   make it, or Reset Link over an existing one; answers the link's path once
//   DELETE Turn Off
import type {
  MyWorkCalendarFeedIssueResponse,
  MyWorkCalendarFeedResponse,
} from '@liveplanner/api-schema';
import type { IndexClient } from '@liveworkspace/index-client';
import { feedTokenHash, newFeedToken } from '../calendar/feed-token';
import { indexFor } from '../index-service';
import { json, methodNotAllowed, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { myWorkFeedPath } from './my-work-feed-route';

const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(status: number, error: string, reason: string): Response {
  console.info('[calendar-feed] refused', { reason });
  return answer({ error }, status);
}

type Door = (index: IndexClient) => Promise<Response>;

const read: Door = async (index) => {
  const body: MyWorkCalendarFeedResponse = { feed: (await index.calendarFeed()).feed };
  return answer(body);
};

const issue: Door = async (index) => {
  const reset = (await index.calendarFeed()).feed !== null;
  const token = newFeedToken();
  const { feed } = await index.putCalendarFeed(await feedTokenHash(token));
  console.info('[calendar-feed] manage', { action: reset ? 'my_work_reset' : 'my_work_made' });
  const body: MyWorkCalendarFeedIssueResponse = { feed, path: myWorkFeedPath(token) };
  return answer(body, 201);
};

const turnOff: Door = async (index) => {
  await index.deleteCalendarFeed();
  console.info('[calendar-feed] manage', { action: 'my_work_off' });
  return noContent();
};

const DOORS: Record<string, Door> = { GET: read, POST: issue, DELETE: turnOff };

/** `/api/my-work/calendar-feed`. */
export async function handleMyWorkCalendarFeedRoutes(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  if (segments.length !== 3 || segments[2] !== 'calendar-feed') return notFound();
  const method = request.method;
  const door = method === 'GET' || method === 'POST' || method === 'DELETE' ? DOORS[method]! : null;
  if (!door) return methodNotAllowed();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const person = ctx.accountUserId;
  if (!person || ctx.token || ctx.workbench)
    return refuse(403, 'calendar_feed_needs_account', 'not_in_person');
  // The index acts for the person with this app's key; no teams, as the feed's own row needs none.
  const index = indexFor(ctx.env, { kind: 'delegate', personId: person, teams: [] });
  if (!index) return refuse(503, 'calendar_feed_unavailable', 'unavailable');
  try {
    return await door(index);
  } catch (error) {
    console.warn('[calendar-feed] index_failed', { error: String(error) });
    return refuse(503, 'calendar_feed_unavailable', 'unavailable');
  }
}
