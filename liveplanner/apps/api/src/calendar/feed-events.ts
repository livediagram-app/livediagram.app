// A calendar feed's events (docs/specs/026-plan/calendar-feed.md "What it shows"; blueprint calendar-feed.md
// "Events"), read from the plan's own tables in its room: every live card with a built-in Start or Due day, after the
// feed's options, as one all-day event each, capped at FEED_EVENTS_MAX nearest today.

import {
  ARCHIVED_FIELD,
  DAY_MS,
  FALLBACK_ITEM_TYPE,
  dayNumber,
  itemPersonId,
  itemStatus,
  itemTitle,
  notifiedPeople,
  typesOf,
} from '@liveplanner/items';
import { cardPlacesOf } from '@liveplanner/project';
import { listItems } from '../db/items';
import { appBaseUrl } from '../email/client';
import { parseElements, parseTypes } from '../plan-room/plan-cards-push';
import type { PlanEnv } from '../types';
import type { CalendarFeed } from './feed-store';
import type { FeedCalendar, FeedEvent } from './ics';

// The most events one feed answers: several months of a busy plan, and a body of a few hundred KB at most.
export const FEED_EVENTS_MAX = 500;

// The most characters an event's title keeps.
export const FEED_SUMMARY_MAX = 200;

// What a fetch gets back from the room: the calendar, and whether the cap left cards out.
export type FeedRead = FeedCalendar & { truncated: boolean };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// A built-in date as a day number: only a plain `YYYY-MM-DD` day counts (a timed value waits for timed events).
const dayOf = (value: unknown): number | undefined =>
  typeof value === 'string' && ISO_DAY.test(value) ? dayNumber(value) : undefined;

// How far an event lies from today, in days: 0 when today is inside it.
const distance = (e: { startDay: number; endDay: number }, today: number) =>
  today < e.startDay ? e.startDay - today : today > e.endDay ? today - e.endDay : 0;

const cut = (text: string, max: number) =>
  [...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text;

/** The feed's calendar on this plan, or null when the plan has no row (never started, or gone). */
export async function feedEventsOf(
  env: PlanEnv,
  planId: string,
  feed: CalendarFeed,
  now: number,
): Promise<FeedRead | null> {
  const [plan, boardTabs, items] = await Promise.all([
    env.PLAN_DB.prepare('SELECT name, item_types FROM plan WHERE id = ?')
      .bind(planId)
      .first<{ name: string; item_types: string | null }>(),
    // Only the tabs a board is on, in the plan's order (as the Inbox push reads them, plan-cards-push.ts).
    env.PLAN_DB.prepare(
      `SELECT t.id, t.name, t.data FROM tabs t JOIN plan_tabs dt ON dt.tab_id = t.id
        WHERE dt.plan_id = ? AND t.data LIKE '%"plan-board"%' ORDER BY dt.order_index`,
    )
      .bind(planId)
      .all<{ id: string; name: string; data: string }>(),
    listItems(env, planId),
  ]);
  if (!plan) return null;
  const places = cardPlacesOf(
    (boardTabs.results ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      elements: parseElements(t.data),
    })),
  );
  const types = new Map(typesOf(parseTypes(plan.item_types)).map((t) => [t.id, t]));
  const me = feed.mine ? await itemPersonId(feed.personId) : null;
  const base = appBaseUrl(env);
  const events: (FeedEvent & { key: number })[] = [];
  for (const item of items) {
    if (item.fields[ARCHIVED_FIELD] === true) continue;
    const status = itemStatus(item);
    if (status === 'trash') continue;
    if (!feed.includeDone && places.isDone(status)) continue;
    const board = places.boardFor(status);
    if (feed.boardId !== null && board?.elementId !== feed.boardId) continue;
    if (me !== null) {
      const told = notifiedPeople(types.get(item.type) ?? FALLBACK_ITEM_TYPE, item);
      if (!told.some(({ person }) => person.id === me)) continue;
    }
    const start = dayOf(item.fields['start']);
    const due = dayOf(item.fields['due']);
    if (start === undefined && due === undefined) continue;
    const startOnly = due === undefined;
    const startDay = due === undefined ? start! : start !== undefined && start <= due ? start : due;
    const endDay = due ?? start!;
    const title = `#${item.key} ${itemTitle(item) || 'Untitled'}`;
    const url = `${base}/project/${encodeURIComponent(planId)}#item=${encodeURIComponent(item.id)}`;
    const column = places.columnFor(status);
    const where = [board?.title, column?.name].filter((s): s is string => !!s).join(' · ');
    events.push({
      key: item.key,
      uid: `${item.id}.${planId}@liveplanner.app`,
      summary: cut(startOnly ? `Starts: ${title}` : title, FEED_SUMMARY_MAX),
      url,
      description: where ? `${where}\n${url}` : url,
      startDay,
      endDay,
      stamp: item.updatedAt,
      sequence: item.rev,
    });
  }
  const today = Math.floor(now / DAY_MS);
  const truncated = events.length > FEED_EVENTS_MAX;
  const kept = truncated
    ? events
        .sort((a, b) => distance(a, today) - distance(b, today) || a.key - b.key)
        .slice(0, FEED_EVENTS_MAX)
    : events;
  kept.sort((a, b) => a.startDay - b.startDay || a.key - b.key);
  return {
    name: plan.name,
    truncated,
    events: kept.map(({ key: _key, ...event }) => event),
  };
}
