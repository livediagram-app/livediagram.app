// The calendar feed's signed-in routes as Subscribe to Calendar calls them (docs/specs/026-plan/calendar-feed.md
// "Managing a feed"; blueprint calendar-feed.md "Part 2"), typed with @liveplanner/api-schema. Always the person's own
// feed, never through a share link: the dialog only opens for the plan's owner or a team member.

import type {
  CalendarFeedIssueResponse,
  CalendarFeedOptions,
  CalendarFeedOptionsResponse,
  CalendarFeedResponse,
  MyWorkCalendarFeedIssueResponse,
  MyWorkCalendarFeedResponse,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';
import type { CalendarFeedScope } from './calendar-feed-gate';

const url = (scope: CalendarFeedScope) =>
  `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/calendar-feed`;

async function call(
  scope: CalendarFeedScope,
  method: string,
  body?: CalendarFeedOptions,
): Promise<Response> {
  return apiFetch(url(scope), {
    method,
    headers: await apiHeaders(scope.ownerId, { share: null, body: body !== undefined }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** The person's feed (never its link) and the plan's boards. */
export async function readCalendarFeed(scope: CalendarFeedScope): Promise<CalendarFeedResponse> {
  return expectOk<CalendarFeedResponse>(await call(scope, 'GET'), 'read calendar feed');
}

/** Make the feed, or Reset Link over an existing one: the link's path, this once. */
export async function issueCalendarFeed(
  scope: CalendarFeedScope,
  options: CalendarFeedOptions,
): Promise<CalendarFeedIssueResponse> {
  return expectOk<CalendarFeedIssueResponse>(
    await call(scope, 'POST', options),
    'make calendar feed',
  );
}

/** Change the feed's options, keeping its link. */
export async function changeCalendarFeed(
  scope: CalendarFeedScope,
  options: CalendarFeedOptions,
): Promise<CalendarFeedOptionsResponse> {
  return expectOk<CalendarFeedOptionsResponse>(
    await call(scope, 'PUT', options),
    'change calendar feed',
  );
}

/** Turn Off. */
export async function turnOffCalendarFeed(scope: CalendarFeedScope): Promise<void> {
  return expectOkVoid(await call(scope, 'DELETE'), 'turn off calendar feed');
}

// The My Work feed (docs/specs/026-plan/calendar-feed.md "The My Work feed"): the person's own, across plans.
async function myWork(ownerId: string, method: string): Promise<Response> {
  return apiFetch(`${API_BASE}/my-work/calendar-feed`, {
    method,
    headers: await apiHeaders(ownerId, { share: null, body: false }),
  });
}

/** Whether the person has a My Work feed, and when its link was made (never the link). */
export async function readMyWorkCalendarFeed(ownerId: string): Promise<MyWorkCalendarFeedResponse> {
  return expectOk<MyWorkCalendarFeedResponse>(await myWork(ownerId, 'GET'), 'read my work feed');
}

/** Make the My Work feed, or Reset Link over an existing one: the link's path, this once. */
export async function issueMyWorkCalendarFeed(
  ownerId: string,
): Promise<MyWorkCalendarFeedIssueResponse> {
  return expectOk<MyWorkCalendarFeedIssueResponse>(
    await myWork(ownerId, 'POST'),
    'make my work feed',
  );
}

/** Turn Off the My Work feed. */
export async function turnOffMyWorkCalendarFeed(ownerId: string): Promise<void> {
  return expectOkVoid(await myWork(ownerId, 'DELETE'), 'turn off my work feed');
}
