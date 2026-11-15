// A calendar feed link's fetch as the plan's room answers it (docs/specs/026-plan/calendar-feed.md "How it answers"):
// one RPC, two calls. First the feed a token's hash names; then, once the worker has checked the person's access,
// the feed's calendar. The worker's client (plan-client.ts) names them as two calls.

import type { PlanEnv } from '../types';
import { feedEventsOf, type FeedRead } from './feed-events';
import { calendarFeedOf, type CalendarFeed } from './feed-store';

export type FeedRoomCall =
  { kind: 'feed'; tokenHash: string } | { kind: 'events'; feed: CalendarFeed; now: number };

export type FeedRoomAnswer = CalendarFeed | FeedRead | null;

export function answerFeedCall(
  env: PlanEnv,
  planId: string,
  call: FeedRoomCall,
): Promise<FeedRoomAnswer> {
  return call.kind === 'feed'
    ? calendarFeedOf(env, planId, call.tokenHash)
    : feedEventsOf(env, planId, call.feed, call.now);
}
