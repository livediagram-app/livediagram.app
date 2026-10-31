// A card's history in the plan's own SQLite (docs/specs/026-plan/items.md "History", blueprint item-store.md
// "History"): appended by the plan's item writes once they land, read one card at a time when its panel opens, and
// bounded per card on every append and across the plan by the daily upkeep. Only `env.PLAN_DB`, the plan's Durable
// Object storage: history never touches D1, the index or the room.

import {
  ITEM_HISTORY_MAX,
  ITEM_HISTORY_MAX_AGE_MS,
  historyChangesOf,
  readStoredHistory,
  type Item,
  type ItemHistoryTag,
  type StoredHistoryEntry,
} from '@liveplanner/items';
import type { PlanEnv } from '../types';

// One landed write to one card: the card as it stood (null for a create) and as written.
export type HistoryWrite = { before: Item | null; after: Item };

// Appends an entry per write that changed something a reader asks about, in one batch: one insert for every entry
// (the rows as one JSON parameter, so a bulk create of n cards adds one statement, not n), then each changed card's
// trim: its entries past ITEM_HISTORY_MAX, and those past the age limit, go. A made card has nothing to trim (a card
// put back after a delete starts a new history; its old one went with it). Never throws: the card's write has
// landed, and a history that could not be kept must not refuse it. Answers how many entries it kept.
export async function appendItemHistory(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  writes: readonly HistoryWrite[],
  tag?: ItemHistoryTag,
): Promise<number> {
  const db = env.PLAN_DB;
  const rows: { i: string; a: number; b: string; c: string }[] = [];
  const trimmed = new Set<string>();
  let cutoff = 0;
  for (const { before, after } of writes) {
    const changes = historyChangesOf(before, after);
    if (changes.length === 0) continue;
    const by = before ? after.updatedBy : after.createdBy;
    rows.push({
      i: after.id,
      a: after.updatedAt,
      b: JSON.stringify(by),
      c: JSON.stringify(changes),
    });
    if (before) trimmed.add(after.id);
    cutoff = Math.max(cutoff, after.updatedAt - ITEM_HISTORY_MAX_AGE_MS);
  }
  if (rows.length === 0) return 0;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO item_history (plan_id, item_id, at, by, tag, changes)
         SELECT ?, j.value ->> '$.i', j.value ->> '$.a', j.value ->> '$.b', ?, j.value ->> '$.c'
           FROM json_each(?) j`,
      )
      .bind(projectId, tag ?? null, JSON.stringify(rows)),
  ];
  for (const itemId of trimmed) {
    statements.push(
      db
        .prepare(
          `DELETE FROM item_history WHERE plan_id = ? AND item_id = ? AND (at < ? OR id <= COALESCE(
             (SELECT id FROM item_history WHERE plan_id = ? AND item_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?), -1))`,
        )
        .bind(projectId, itemId, cutoff, projectId, itemId, ITEM_HISTORY_MAX),
    );
  }
  try {
    await db.batch(statements);
    return rows.length;
  } catch (error) {
    console.warn('[items] history.append.failed', { projectId, error: String(error) });
    return 0;
  }
}

// A card's entries as stored, newest first, none past the age limit (a card not written since may hold some until
// the daily upkeep), at most ITEM_HISTORY_MAX.
export async function readItemHistory(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  itemId: string,
  now: number,
): Promise<StoredHistoryEntry[]> {
  const res = await env.PLAN_DB.prepare(
    `SELECT at, by, tag, changes FROM item_history
      WHERE plan_id = ? AND item_id = ? AND at >= ? ORDER BY id DESC LIMIT ?`,
  )
    .bind(projectId, itemId, now - ITEM_HISTORY_MAX_AGE_MS, ITEM_HISTORY_MAX)
    .all<{ at: unknown; by: unknown; tag: unknown; changes: unknown }>();
  const out: StoredHistoryEntry[] = [];
  for (const row of res.results ?? []) {
    const entry = readStoredHistory(row);
    if (entry) out.push(entry);
  }
  return out;
}

// The daily upkeep's sweep (plan-room.ts `maintain`): every entry older than `cutoff`, across the plan's cards. Rows
// are appended in time order, so it deletes those before the first fresh one by id, reading only those and one more.
export async function deleteOldItemHistory(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  cutoff: number,
): Promise<number> {
  const res = await env.PLAN_DB.prepare(
    `DELETE FROM item_history WHERE id < COALESCE(
       (SELECT id FROM item_history WHERE at >= ? ORDER BY id LIMIT 1),
       (SELECT MAX(id) + 1 FROM item_history), 0)`,
  )
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}
