// A calendar feed's spans and cap (docs/specs/026-plan/calendar-feed.md "What it shows", "How it answers"; blueprint
// calendar-feed.md "Events"), shared by a plan's feed and the My Work feed: a card's Start and Due days as one all-day
// event, and at most FEED_EVENTS_MAX events, the nearest today kept. Pure.

import { DAY_MS, dayNumber } from '@liveplanner/items';

// The most events one feed answers: several months of a busy plan, and a body of a few hundred KB at most.
export const FEED_EVENTS_MAX = 500;

// The most characters an event's title keeps.
export const FEED_SUMMARY_MAX = 200;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A built-in date as a day number: only a plain `YYYY-MM-DD` day counts (a timed value waits for timed events). */
export const dayOf = (value: unknown): number | undefined =>
  typeof value === 'string' && ISO_DAY.test(value) ? dayNumber(value) : undefined;

export type FeedSpan = { startDay: number; endDay: number; startOnly: boolean };

/** A card's event, both days included: Start to Due, Due alone (or a Start after its Due), or a Start alone. Null for
 *  a card with neither. */
export function spanOf(startValue: unknown, dueValue: unknown): FeedSpan | null {
  const start = dayOf(startValue);
  const due = dayOf(dueValue);
  if (due === undefined)
    return start === undefined ? null : { startDay: start, endDay: start, startOnly: true };
  return {
    startDay: start !== undefined && start <= due ? start : due,
    endDay: due,
    startOnly: false,
  };
}

/** A title cut to `max` characters (whole code points), an ellipsis last when it was cut. */
export const cutText = (text: string, max: number) =>
  [...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text;

/** An event's title: the card's number and title, `Starts: ` before it for a Start alone, cut to FEED_SUMMARY_MAX. */
export const summaryOf = (key: number | null, title: string, startOnly: boolean) => {
  const named = `${key === null ? '' : `#${key} `}${title || 'Untitled'}`;
  return cutText(startOnly ? `Starts: ${named}` : named, FEED_SUMMARY_MAX);
};

// How far an event lies from today, in days: 0 when today is inside it.
const distance = (e: { startDay: number; endDay: number }, today: number) =>
  today < e.startDay ? e.startDay - today : today > e.endDay ? today - e.endDay : 0;

/** At most FEED_EVENTS_MAX events, the nearest today kept (ties by `order`), then sorted by start day and `order`. */
export function capEvents<T extends { startDay: number; endDay: number; order: number }>(
  events: T[],
  now: number,
): { kept: T[]; truncated: boolean } {
  const today = Math.floor(now / DAY_MS);
  const truncated = events.length > FEED_EVENTS_MAX;
  const kept = truncated
    ? events
        .sort((a, b) => distance(a, today) - distance(b, today) || a.order - b.order)
        .slice(0, FEED_EVENTS_MAX)
    : events;
  kept.sort((a, b) => a.startDay - b.startDay || a.order - b.order);
  return { kept, truncated };
}
