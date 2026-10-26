// A closed account's name off a design that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which designs name them (POST /api/internal/people/:id/purge), and each design's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments
// and assignments in each tab, the changesets they wrote, the design's owner when it was their team design, and
// their right to have images placed here. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.

import { ANONYMISED_NAME, ANONYMISED_PERSON, anonymiseJsonText } from '@liveworkspace/index-app';
import type { DesignEnv } from '../types';

export async function anonymiseDesign(
  env: DesignEnv,
  designId: string,
  personId: string,
): Promise<number> {
  const db = env.DESIGN_DB;
  const now = Date.now();
  const like = `%${personId}%`;
  const tabs = await db
    .prepare(
      `SELECT t.id, t.data, t.rev FROM tabs t JOIN design_tabs pt ON pt.tab_id = t.id
        WHERE pt.design_id = ? AND t.data LIKE ?`,
    )
    .bind(designId, like)
    .all();
  const writes: D1PreparedStatement[] = [];
  for (const tab of (tabs.results ?? []) as { id: string; data: string; rev: number }[]) {
    const { value, changed } = anonymiseJsonText(tab.data, personId);
    if (changed) {
      writes.push(
        db
          .prepare('UPDATE tabs SET data = ?, rev = ?, updated_at = ? WHERE id = ? AND rev = ?')
          .bind(value, tab.rev + 1, now, tab.id, tab.rev),
      );
    }
  }
  writes.push(
    db
      .prepare(
        'UPDATE agent_changesets SET author_id = ?, author_name = ? WHERE design_id = ? AND author_id = ?',
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, designId, personId),
    db
      .prepare('UPDATE design SET owner_id = ? WHERE id = ? AND owner_id = ?')
      .bind(ANONYMISED_PERSON, designId, personId),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
