// A person's own calendar feed of a plan, `/api/projects/:id/calendar-feed`, inside the plan's room
// (docs/specs/026-plan/calendar-feed.md "Managing a feed"; blueprint calendar-feed.md "Part 2"). Every route is the
// plan's owner's or a team member's, signed in, in person: never an API token, a workbench session, a guest or anyone
// who holds the plan through a share link, at any level (403 `calendar_feed_needs_member`).
//
//   GET    the person's feed (its options and when its link was made, never the link) and the plan's boards
//   POST   make the feed with the body's options, or, over an existing one, Reset Link; answers the link's path once
//   PUT  change the feed's options, keeping its link (404 without a feed)
//   DELETE Turn Off
import type {
  CalendarFeedIssueResponse,
  CalendarFeedOptions,
  CalendarFeedOptionsResponse,
  CalendarFeedResponse,
} from '@liveplanner/api-schema';
import { feedBoardsOf } from '../calendar/feed-boards';
import {
  calendarFeedFor,
  issueCalendarFeed,
  revokeCalendarFeed,
  setCalendarFeedOptions,
} from '../calendar/feed-store';
import { getProject } from '../db';
import { json, methodNotAllowed, noContent } from '../responses';
import { grantOn, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

// The longest board id the Board option takes: element ids are far shorter.
export const FEED_BOARD_ID_MAX = 200;

const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(status: number, error: string, reason: string): Response {
  console.info('[calendar-feed] refused', { reason });
  return answer({ error }, status);
}

// The door every route passes: the person's account id, or the refusal.
async function feedMember(ctx: PlanRouteContext, projectId: string): Promise<string | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await getProject(ctx.env, projectId))) return missingProject(ctx, projectId);
  const person = ctx.accountUserId;
  if (!person || ctx.token || ctx.workbench)
    return refuse(403, 'calendar_feed_needs_member', 'not_in_person');
  const grant = grantOn(ctx, projectId);
  // The owner's and a team member's grants carry no share code and reach every tab; a link's never does both.
  if (!grant || grant.shareCode !== null || grant.tabScope !== null || grant.community)
    return refuse(403, 'calendar_feed_needs_member', 'no_member_grant');
  return person;
}

// The body's options, checked against the plan's boards, or null.
async function optionsOf(
  ctx: PlanRouteContext,
  projectId: string,
): Promise<CalendarFeedOptions | Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const { boardId = null, mine = false, includeDone = false } = raw;
  const flags = typeof mine === 'boolean' && typeof includeDone === 'boolean';
  const boardShape =
    boardId === null ||
    (typeof boardId === 'string' && boardId.length > 0 && boardId.length <= FEED_BOARD_ID_MAX);
  if (!flags || !boardShape) return refuse(400, 'calendar_feed_invalid', 'invalid');
  if (boardId !== null) {
    const boards = await feedBoardsOf(ctx.env, projectId);
    if (!boards.some((b) => b.id === boardId))
      return refuse(400, 'calendar_feed_invalid', 'invalid');
  }
  return { boardId, mine, includeDone };
}

async function read(ctx: PlanRouteContext, projectId: string, person: string): Promise<Response> {
  const [feed, boards] = await Promise.all([
    calendarFeedFor(ctx.env, projectId, person),
    feedBoardsOf(ctx.env, projectId),
  ]);
  const body: CalendarFeedResponse = { feed, boards };
  return answer(body);
}

async function issue(ctx: PlanRouteContext, projectId: string, person: string): Promise<Response> {
  const options = await optionsOf(ctx, projectId);
  if (options instanceof Response) return options;
  const reset = (await calendarFeedFor(ctx.env, projectId, person)) !== null;
  const now = Date.now();
  const token = await issueCalendarFeed(ctx.env, projectId, person, options, now);
  console.info('[calendar-feed] manage', { action: reset ? 'reset' : 'made' });
  const body: CalendarFeedIssueResponse = {
    feed: { ...options, createdAt: now },
    path: `/api/calendar/${encodeURIComponent(projectId)}/${token}.ics`,
  };
  return answer(body, 201);
}

async function change(ctx: PlanRouteContext, projectId: string, person: string): Promise<Response> {
  const options = await optionsOf(ctx, projectId);
  if (options instanceof Response) return options;
  if (!(await setCalendarFeedOptions(ctx.env, projectId, person, options)))
    return answer({ error: 'calendar_feed_not_found' }, 404);
  const feed = await calendarFeedFor(ctx.env, projectId, person);
  console.info('[calendar-feed] manage', { action: 'options' });
  const body: CalendarFeedOptionsResponse = { feed: feed! };
  return answer(body);
}

async function turnOff(
  ctx: PlanRouteContext,
  projectId: string,
  person: string,
): Promise<Response> {
  if (await revokeCalendarFeed(ctx.env, projectId, person))
    console.info('[calendar-feed] manage', { action: 'off' });
  return noContent();
}

type Door = (ctx: PlanRouteContext, projectId: string, person: string) => Promise<Response>;

const DOORS: Record<string, Door> = { GET: read, POST: issue, PUT: change, DELETE: turnOff };

/** `/api/projects/:id/calendar-feed`, or null for any other path. */
export async function handleCalendarFeedRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'calendar-feed') return null;
  const method = request.method;
  const door =
    method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE'
      ? DOORS[method]!
      : null;
  if (!door) return methodNotAllowed();
  const projectId = segments[2]!;
  const person = await feedMember(ctx, projectId);
  return person instanceof Response ? person : door(ctx, projectId, person);
}
