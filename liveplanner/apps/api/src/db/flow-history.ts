// The flow charts' plan-wide read of card history (docs/specs/026-plan/items.md "History", plan-views.md "Flow
// charts", blueprint item-store.md "Flow read"): every kept move, statuses only, and the cards that made them. Only
// `env.PLAN_DB`, the plan's Durable Object storage. Never an entry's author, tag or values.

import type { FlowCard } from '@liveplanner/items';
import type { PlanEnv } from '../types';

// One kept move: at `at`, card `itemId` went from status `from` to status `to` (null for none).
export type FlowMoveRow = { itemId: string; at: number; from: string | null; to: string | null };

// Every move kept since `since` (ms), oldest first. The `instr` skips the JSON walk of each entry holding no move
// (most hold a field change), so the statement walks only the entries that moved a card.
export async function readFlowMoves(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  since: number,
): Promise<FlowMoveRow[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT h.item_id AS itemId, h.at AS at, j.value ->> '$.from' AS "from", j.value ->> '$.to' AS "to"
       FROM item_history h, json_each(h.changes) j
      WHERE h.plan_id = ? AND h.at >= ? AND instr(h.changes, '"kind":"moved"') > 0
        AND j.value ->> '$.kind' = 'moved'
      ORDER BY h.id, j.key`,
  )
    .bind(projectId, since)
    .all<FlowMoveRow>();
  return res.results;
}

// The cards of `ids` that exist: each one's type, when it was made, and its oldest history entry kept since `since`
// (one seek per card on the history's (plan_id, item_id) index), their moves still to add. The ids go as one JSON
// parameter.
export async function readFlowCards(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  ids: readonly string[],
  since: number,
): Promise<Omit<FlowCard, 'moves'>[]> {
  if (ids.length === 0) return [];
  const res = await env.PLAN_DB.prepare(
    `SELECT i.id AS id, i.type AS type, i.created_at AS createdAt,
            COALESCE((SELECT MIN(h.at) FROM item_history h
                       WHERE h.plan_id = i.plan_id AND h.item_id = i.id AND h.at >= ?1), i.created_at) AS since
       FROM items i
      WHERE i.plan_id = ?2 AND i.id IN (SELECT value FROM json_each(?3))`,
  )
    .bind(since, projectId, JSON.stringify(ids))
    .all<Omit<FlowCard, 'moves'>>();
  return res.results;
}
