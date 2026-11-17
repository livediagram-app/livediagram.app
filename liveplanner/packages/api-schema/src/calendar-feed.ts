// A person's calendar feed of one plan as the signed-in routes answer it (docs/specs/026-plan/calendar-feed.md
// "Managing a feed"; blueprint calendar-feed.md "Part 2"). Never the token, except the one time POST answers the
// feed's path.

/** What a feed shows: the cards of some card types (null: every type), only the cards that name the person, and done
 *  cards or not. `boardId`, read-only, is a feed made before card types (one board's cards); saving options clears it. */
export type CalendarFeedOptions = {
  typeIds: string[] | null;
  boardId?: string | null;
  mine: boolean;
  includeDone: boolean;
};

/** The most card types a feed may name. */
export const CALENDAR_FEED_TYPES_MAX = 50;

/** A card type the Card Types option may name: its id, name, and the glyph and colour its cards wear. */
export type CalendarFeedType = { id: string; name: string; glyph: string; color: string };

/** The person's own feed: its options, and when its link was made (a reset renews it), epoch ms. */
export type CalendarFeedSettings = CalendarFeedOptions & { createdAt: number };

/** GET /api/projects/:id/calendar-feed: the person's feed, or null for none, and the plan's card types. */
export type CalendarFeedResponse = {
  feed: CalendarFeedSettings | null;
  types: CalendarFeedType[];
};

/** POST /api/projects/:id/calendar-feed: the feed made (or its link reset), and its link's path
 *  (`/api/calendar/<plan id>/lpf_….ics`), answered this once. */
export type CalendarFeedIssueResponse = { feed: CalendarFeedSettings; path: string };

/** PUT /api/projects/:id/calendar-feed: the feed with its new options, its link kept. */
export type CalendarFeedOptionsResponse = { feed: CalendarFeedSettings };

/** The person's My Work feed (docs/specs/026-plan/calendar-feed.md "The My Work feed"): when its link was made, epoch
 *  ms. It has no options. */
export type MyWorkCalendarFeed = { createdAt: number };

/** GET /api/my-work/calendar-feed: the person's My Work feed, or null for none. */
export type MyWorkCalendarFeedResponse = { feed: MyWorkCalendarFeed | null };

/** POST /api/my-work/calendar-feed: the feed made (or its link reset), and its link's path
 *  (`/api/calendar/my-work/lpf_….ics`), answered this once. */
export type MyWorkCalendarFeedIssueResponse = { feed: MyWorkCalendarFeed; path: string };

/** The refusals the routes name. */
export const CALENDAR_FEED_ERRORS = [
  'calendar_feed_needs_member',
  'calendar_feed_needs_account',
  'calendar_feed_invalid',
  'calendar_feed_not_found',
  'calendar_feed_unavailable',
] as const;
export type CalendarFeedError = (typeof CALENDAR_FEED_ERRORS)[number];
