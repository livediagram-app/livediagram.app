// A closed account's name off a plan that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which plans name them (POST /api/internal/people/:id/purge), and each plan's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments,
// cards and assignments in each tab, the cards' own fields, comment threads and history and who made or changed them, the changesets they
// wrote, and the plan's owner when it was their team plan. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.

import { ANONYMISED_NAME, ANONYMISED_PERSON, anonymiseJsonText } from '@liveworkspace/index-app';
import { itemPersonId } from '@liveplanner/items';
import type { PlanEnv } from '../types';

// A closed account as a card's history names them.
const ANONYMISED_AUTHOR = { id: ANONYMISED_PERSON, name: ANONYMISED_NAME, color: '#94a3b8' };

export async function anonymisePlan(
  env: PlanEnv,
  planId: string,
  personId: string,
): Promise<number> {
  const db = env.PLAN_DB;
  const now = Date.now();
  const like = `%${personId}%`;
  const [tabs, items, threads] = await db.batch([
    db
      .prepare(
        `SELECT t.id, t.data, t.rev FROM tabs t JOIN plan_tabs pt ON pt.tab_id = t.id
          WHERE pt.plan_id = ? AND t.data LIKE ?`,
      )
      .bind(planId, like),
    db
      .prepare('SELECT id, fields FROM items WHERE plan_id = ? AND fields LIKE ?')
      .bind(planId, like),
    // The cards' comment threads this plan stores: their comments and who started them.
    db
      .prepare(
        `SELECT id, comments, created_by FROM card_threads
          WHERE plan_id = ? AND (comments LIKE ?2 OR created_by LIKE ?2)`,
      )
      .bind(planId, like),
  ]);
  const writes: D1PreparedStatement[] = [];
  for (const tab of (tabs?.results ?? []) as { id: string; data: string; rev: number }[]) {
    const { value, changed } = anonymiseJsonText(tab.data, personId);
    if (changed) {
      writes.push(
        db
          .prepare('UPDATE tabs SET data = ?, rev = ?, updated_at = ? WHERE id = ? AND rev = ?')
          .bind(value, tab.rev + 1, now, tab.id, tab.rev),
      );
    }
  }
  for (const item of (items?.results ?? []) as { id: string; fields: string }[]) {
    const { value, changed } = anonymiseJsonText(item.fields, personId);
    if (changed) {
      writes.push(
        db
          .prepare('UPDATE items SET fields = ? WHERE plan_id = ? AND id = ?')
          .bind(value, planId, item.id),
      );
    }
  }
  type ThreadRow = { id: string; comments: string; created_by: string };
  for (const thread of (threads?.results ?? []) as ThreadRow[]) {
    const comments = anonymiseJsonText(thread.comments, personId);
    const by = anonymiseJsonText(thread.created_by, personId);
    if (comments.changed || by.changed) {
      writes.push(
        db
          .prepare(
            'UPDATE card_threads SET comments = ?, created_by = ? WHERE plan_id = ? AND id = ?',
          )
          .bind(comments.value, by.value, planId, thread.id),
      );
    }
  }
  // The cards' history names its authors as the cards do, by their hashed id (docs/specs/026-plan/items.md
  // "History"): their entries read Deleted account.
  writes.push(
    db
      .prepare(`UPDATE item_history SET by = ? WHERE plan_id = ? AND by ->> '$.id' = ?`)
      .bind(JSON.stringify(ANONYMISED_AUTHOR), planId, await itemPersonId(personId)),
  );
  writes.push(
    db
      .prepare('UPDATE items SET created_by = ? WHERE plan_id = ? AND created_by = ?')
      .bind(ANONYMISED_PERSON, planId, personId),
    db
      .prepare('UPDATE items SET updated_by = ? WHERE plan_id = ? AND updated_by = ?')
      .bind(ANONYMISED_PERSON, planId, personId),
    db
      .prepare(
        'UPDATE agent_changesets SET author_id = ?, author_name = ? WHERE plan_id = ? AND author_id = ?',
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, planId, personId),
    db
      .prepare('UPDATE plan SET owner_id = ? WHERE id = ? AND owner_id = ?')
      .bind(ANONYMISED_PERSON, planId, personId),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
