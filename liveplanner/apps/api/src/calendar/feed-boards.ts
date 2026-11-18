// What a calendar feed's Card Types option may name (docs/specs/026-plan/calendar-feed.md "The options"; blueprint
// calendar-feed.md "Card types in place of a board"): the plan's card types, in its catalogue's order.

import type { CalendarFeedType } from '@liveplanner/api-schema';
import { typesOf } from '@liveplanner/items';
import { parseTypes } from '../plan-room/plan-cards-push';
import type { PlanEnv } from '../types';

/** The card types the Card Types option may name (calendar-feed.md "The options"): the plan's catalogue, in order. */
export async function feedTypesOf(env: PlanEnv, planId: string): Promise<CalendarFeedType[]> {
  const row = await env.PLAN_DB.prepare('SELECT item_types FROM plan WHERE id = ?')
    .bind(planId)
    .first<{ item_types: string | null }>();
  return typesOf(parseTypes(row?.item_types ?? null)).map((t) => ({
    id: t.id,
    name: t.label,
    glyph: t.glyph,
    color: t.color,
  }));
}
