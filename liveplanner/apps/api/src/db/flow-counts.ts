// The plan's daily flow counts in its own SQLite (docs/specs/026-plan/items.md "Flow counts", blueprint item-store.md
// "Flow counts"): written by the triggers of schema step V29 (plan-room/flow-counts-schema.ts), read for a range by
// the flow charts, and trimmed by the daily upkeep. Only `env.PLAN_DB`, the plan's Durable Object storage: the counts
// never touch D1, the index or the room.

import { FLOW_DAYS_MAX, type FlowCountRow } from '@liveplanner/items';
import type { PlanEnv } from '../types';

// The stored rows a range needs: every day from `fromDay` to `toDay`, and the last stored day at or before `fromDay`,
// which the range's first days carry (@liveplanner/items flowCountsOf reads them). Oldest first. Two index seeks on
// the primary key, so a read is linear in the rows answered, never in the days the plan keeps.
export async function readFlowCounts(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  fromDay: number,
  toDay: number,
): Promise<FlowCountRow[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT day, type, status, cards FROM flow_counts
      WHERE plan_id = ?1 AND day <= ?3
        AND day >= COALESCE((SELECT MAX(day) FROM flow_counts WHERE plan_id = ?1 AND day <= ?2), ?2)
      ORDER BY day`,
  )
    .bind(projectId, fromDay, toDay)
    .all<FlowCountRow>();
  return res.results;
}

// The daily upkeep's sweep (plan-room-content.ts `maintain`): every day older than FLOW_DAYS_MAX days before `today`
// but the last one of them, which the kept days after it carry. Answers how many rows went.
export async function deleteOldFlowCounts(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  today: number,
): Promise<number> {
  const res = await env.PLAN_DB.prepare(
    `DELETE FROM flow_counts
      WHERE day < (SELECT MAX(day) FROM flow_counts WHERE day <= ?)`,
  )
    .bind(today - FLOW_DAYS_MAX)
    .run();
  return res.meta.changes;
}
