// The My Work feed's events (docs/specs/026-plan/calendar-feed.md "The My Work feed"; blueprint calendar-feed.md
// "Part 3"): the open, dated cards the index lists as assigned to the person across their plans, each one all-day
// event titled and linked as a plan feed's, capped at FEED_EVENTS_MAX nearest today. Pure.

import type { CalendarCard } from '@liveworkspace/index-client';
import type { FeedRead } from './feed-events';
import { capEvents, spanOf, summaryOf } from './feed-span';
import type { FeedEvent } from './ics';

// What the calendar app shows the feed as (writeCalendar adds " · liveplanner").
export const MY_WORK_FEED_NAME = 'My Work';

/** The person's cards as a calendar. `base` is the app's address the links open in. */
export function myWorkEventsOf(
  cards: readonly CalendarCard[],
  base: string,
  now: number,
): FeedRead {
  const events: (FeedEvent & { order: number })[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const span = spanOf(c.card.start, c.card.due);
    if (!span) continue;
    // A card two of whose fields name the person is listed once per field: one event.
    const uid = `${c.cardId}.${c.itemId}.my-work@liveplanner.app`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const url = `${base}/project/${encodeURIComponent(c.itemId)}#item=${encodeURIComponent(c.cardId)}`;
    const where = [c.itemTitle, c.card.board?.title, c.card.column?.name]
      .filter((s): s is string => !!s)
      .join(' · ');
    events.push({
      // The newest change first among ties: the index lists them newest first.
      order: events.length,
      uid,
      summary: summaryOf(c.card.key, c.card.title, span.startOnly),
      url,
      description: where ? `${where}\n${url}` : url,
      startDay: span.startDay,
      endDay: span.endDay,
      stamp: c.updatedAt,
      sequence: 0,
    });
  }
  const { kept, truncated } = capEvents(events, now);
  return {
    name: MY_WORK_FEED_NAME,
    truncated,
    events: kept.map(({ order: _order, ...event }) => event),
  };
}
