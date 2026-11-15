// A person's calendar feed of one plan as the signed-in routes answer it (docs/specs/026-plan/calendar-feed.md
// "Managing a feed"; blueprint calendar-feed.md "Part 2"). Never the token, except the one time POST answers the
// feed's path.

/** What a feed shows: one board's cards (a plan-board element id) or every board's (null), only the cards that name
 *  the person, and done cards or not. */
export type CalendarFeedOptions = { boardId: string | null; mine: boolean; includeDone: boolean };

/** The person's own feed: its options, and when its link was made (a reset renews it), epoch ms. */
export type CalendarFeedSettings = CalendarFeedOptions & { createdAt: number };

/** A board the Board option may name: its element id, its title and its tab's name. */
export type CalendarFeedBoard = { id: string; title: string; tabName: string };

/** GET /api/projects/:id/calendar-feed: the person's feed, or null for none, and the plan's boards. */
export type CalendarFeedResponse = {
  feed: CalendarFeedSettings | null;
  boards: CalendarFeedBoard[];
};

/** POST /api/projects/:id/calendar-feed: the feed made (or its link reset), and its link's path
 *  (`/api/calendar/<plan id>/lpf_….ics`), answered this once. */
export type CalendarFeedIssueResponse = { feed: CalendarFeedSettings; path: string };

/** PATCH /api/projects/:id/calendar-feed: the feed with its new options, its link kept. */
export type CalendarFeedOptionsResponse = { feed: CalendarFeedSettings };

/** The refusals the routes name. */
export const CALENDAR_FEED_ERRORS = [
  'calendar_feed_needs_member',
  'calendar_feed_invalid',
  'calendar_feed_not_found',
] as const;
export type CalendarFeedError = (typeof CALENDAR_FEED_ERRORS)[number];
