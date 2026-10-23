// A closed account's name off a plan that outlives them (liveworkspace/docs/one-explorer-contracts.md "Closing an
// account"): the index tells the app which plans name them (POST /api/internal/people/:id/purge), and each plan's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments,
// cards and assignments in each tab, the cards' own fields and who made or changed them, the changesets they
// wrote, and the plan's owner when it was their team plan. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.

import { ANONYMISED_NAME, ANONYMISED_PERSON, anonymiseJsonText } from '@liveworkspace/index-app';
import type { PlanEnv } from '../types';

export async function anonymisePlan(
  env: PlanEnv,
  planId: string,
  personId: string,
): Promise<number> {
  const db = env.PLAN_DB;
  const now = Date.now();
  const like = `%${personId}%`;
  const [tabs, items] = await db.batch([
    db
      .prepare(
        `SELECT t.id, t.data, t.rev FROM tabs t JOIN plan_tabs pt ON pt.tab_id = t.id
          WHERE pt.plan_id = ? AND t.data LIKE ?`,
      )
      .bind(planId, like),
    db
      .prepare('SELECT id, fields FROM items WHERE plan_id = ? AND fields LIKE ?')
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
