// A calendar feed's events (docs/specs/026-plan/calendar-feed.md "What it shows"; blueprint calendar-feed.md
// "Events"), read from the plan's own tables in its room: every live card with a built-in Start or Due day, after the
// feed's options, as one all-day event each, capped at FEED_EVENTS_MAX nearest today.

import {
  ARCHIVED_FIELD,
  FALLBACK_ITEM_TYPE,
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
import { capEvents, spanOf, summaryOf } from './feed-span';
import type { FeedCalendar, FeedEvent } from './ics';

export { FEED_EVENTS_MAX, FEED_SUMMARY_MAX } from './feed-span';

// What a fetch gets back: the calendar, and whether the cap left cards out.
export type FeedRead = FeedCalendar & { truncated: boolean };

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
  const catalogue = typesOf(parseTypes(plan.item_types));
  const types = new Map(catalogue.map((t) => [t.id, t]));
  const me = feed.mine ? await itemPersonId(feed.personId) : null;
  const base = appBaseUrl(env);
  const events: (FeedEvent & { order: number })[] = [];
  for (const item of items) {
    if (item.fields[ARCHIVED_FIELD] === true) continue;
    const status = itemStatus(item);
    if (status === 'trash') continue;
    if (!feed.includeDone && places.isDone(status)) continue;
    // The board the options name shows the card (Work Tracker 993: boards sharing a status each show it), else
    // every board does.
    // The card types the options name, when they name any: a type spans every board that shows it.
    if (feed.typeIds !== null && !feed.typeIds.includes(item.type)) continue;
    if (feed.boardId !== null && !places.shows(feed.boardId, status, item.type, catalogue))
      continue;
    if (me !== null) {
      const told = notifiedPeople(types.get(item.type) ?? FALLBACK_ITEM_TYPE, item);
      if (!told.some(({ person }) => person.id === me)) continue;
    }
    const span = spanOf(item.fields['start'], item.fields['due']);
    if (!span) continue;
    const url = `${base}/project/${encodeURIComponent(planId)}#item=${encodeURIComponent(item.id)}`;
    // The named board's place when the options name one: the card may open on another board sharing its status.
    const named = feed.boardId !== null ? places.placeOn(feed.boardId, status) : null;
    const boardTitle = named ? named.title : places.boardFor(status)?.title;
    const columnName = named ? named.column : places.columnFor(status)?.name;
    const where = [boardTitle, columnName].filter((s): s is string => !!s).join(' · ');
    events.push({
      order: item.key,
      uid: `${item.id}.${planId}@liveplanner.app`,
      summary: summaryOf(item.key, itemTitle(item), span.startOnly),
      url,
      description: where ? `${where}\n${url}` : url,
      startDay: span.startDay,
      endDay: span.endDay,
      stamp: item.updatedAt,
      sequence: item.rev,
    });
  }
  const { kept, truncated } = capEvents(events, now);
  return {
    name: plan.name,
    truncated,
    events: kept.map(({ order: _order, ...event }) => event),
  };
}
