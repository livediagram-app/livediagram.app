// A whole import's held parts (docs/specs/026-plan/blueprints/tracker-import.md "A whole import"), in the plan's own
// SQLite: every part of `POST /items/import` but the last is kept here, read and checked, until the last lands them
// all in one transaction (routes/item-import-route.ts). Nothing here is a card: no read of the store sees it.

import { chunksOf } from '../plan-room/plan-content';
import type { PlanEnv } from '../types';

// The table: plan-room/item-imports-schema.ts (plan schema step 13).

// How long an import's held parts wait for its last part before any import request (or the plan's daily upkeep)
// clears them: a client that stopped part way never comes back for them.
export const ITEM_IMPORT_HOLD_MS = 60 * 60 * 1000;

/** One part held: its rows, replacing the same part sent before (a resend), as one chunked insert. */
export function holdPartStatements(
  env: PlanEnv,
  planId: string,
  importId: string,
  part: number,
  reads: readonly unknown[],
  now: number,
): D1PreparedStatement[] {
  const db = env.PLAN_DB;
  return [
    db
      .prepare('DELETE FROM item_import_parts WHERE plan_id = ? AND import_id = ? AND part = ?')
      .bind(planId, importId, part),
    ...chunksOf(reads.map((r, s) => ({ s, r }))).map((chunk) =>
      db
        .prepare(
          `INSERT INTO item_import_parts (plan_id, import_id, part, seq, body, created_at)
           SELECT ?1, ?2, ?3, value ->> '$.s', value -> '$.r', ?4 FROM json_each(?5)`,
        )
        .bind(planId, importId, part, now, chunk),
    ),
  ];
}

/** The parts held for an import: each part's number and its card count, in order. */
export async function heldParts(
  env: PlanEnv,
  planId: string,
  importId: string,
): Promise<{ part: number; cards: number }[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT part, COUNT(*) AS cards FROM item_import_parts WHERE plan_id = ? AND import_id = ?
      GROUP BY part ORDER BY part`,
  )
    .bind(planId, importId)
    .all<{ part: number; cards: number }>();
  return res.results ?? [];
}

/** Every held card of an import, as it was read, in part and card order. */
export async function heldReads<T>(env: PlanEnv, planId: string, importId: string): Promise<T[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT body FROM item_import_parts WHERE plan_id = ? AND import_id = ? ORDER BY part, seq`,
  )
    .bind(planId, importId)
    .all<{ body: string }>();
  return (res.results ?? []).map((row) => JSON.parse(row.body) as T);
}

/** An import's held parts gone: when it lands (inside its batch), or when it is refused. */
export function clearImportStatement(
  env: PlanEnv,
  planId: string,
  importId: string,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    'DELETE FROM item_import_parts WHERE plan_id = ? AND import_id = ?',
  ).bind(planId, importId);
}

/** Held parts older than `before` gone, whatever import they wait for. Answers how many cards went. */
export async function sweepHeldImports(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  planId: string,
  before: number,
): Promise<number> {
  const res = await env.PLAN_DB.prepare(
    'DELETE FROM item_import_parts WHERE plan_id = ? AND created_at < ?',
  )
    .bind(planId, before)
    .run();
  return res.meta.changes ?? 0;
}
