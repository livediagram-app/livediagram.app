// The boards a calendar feed's Board option may name (docs/specs/026-plan/calendar-feed.md "The options"; blueprint
// calendar-feed.md "Part 2"): every Plan board on the plan's tabs, in tab order, by its element id, its title and its
// tab's name. Read from the board tabs alone, a batch at a time (plan-route.ts planTabs).

import type { CalendarFeedBoard } from '@liveplanner/api-schema';
import { planOutline } from '@liveplanner/items';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';

export async function feedBoardsOf(env: PlanEnv, planId: string): Promise<CalendarFeedBoard[]> {
  const { boards } = planOutline(await planTabs({ env }, planId, null), null);
  return boards.map((b) => ({ id: b.elementId, title: b.title, tabName: b.tabName }));
}
