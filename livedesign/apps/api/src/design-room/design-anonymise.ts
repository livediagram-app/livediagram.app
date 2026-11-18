// A closed account's name off a design that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which designs name them (POST /api/internal/people/:id/purge), and each design's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments
// and assignments in each tab, the changesets they wrote, the email claims they sent, the design's owner when it
// was their team design, and their right to have images placed here. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.
//
// The person is every id they had: the account's and the guests merged into it (the door's `guests`, Work Tracker
// 1241), so what they left as a guest reads Deleted account as theirs does. Their comment reactions are found by the
// reaction person the room stamps on each (`reactionPersonFor`, docs/specs/012-collaboration/comment-reactions.md).

import {
  ANONYMISED_NAME,
  ANONYMISED_PERSON,
  anonymiseJsonText,
  anonymiseReactionsText,
  closedPersonIds,
  isAnySql,
  mentionsAnySql,
} from '@liveworkspace/index-app';
import { reactionPersonFor } from '@liveworkspace/api-kit/collab-key';
import type { DesignEnv } from '../types';

export async function anonymiseDesign(
  env: DesignEnv,
  designId: string,
  personId: string,
  guestIds: readonly string[] = [],
): Promise<number> {
  const db = env.DESIGN_DB;
  const now = Date.now();
  // Every id they had and its reaction person, each list bound as one JSON parameter (`instr` over it, never a bound
  // LIKE: Durable Object SQLite refuses a LIKE pattern over 50 bytes).
  const ids = closedPersonIds(personId, guestIds);
  const persons = await Promise.all(ids.map((id) => reactionPersonFor(id)));
  const idList = JSON.stringify(ids);
  const needles = JSON.stringify([...ids, ...persons]);
  const tabs = await db
    .prepare(
      `SELECT t.id, t.data, t.rev FROM tabs t JOIN design_tabs pt ON pt.tab_id = t.id
        WHERE pt.design_id = ?1 AND ${mentionsAnySql('t.data', '?2')}`,
    )
    .bind(designId, needles)
    .all();
  const writes: D1PreparedStatement[] = [];
  for (const tab of (tabs.results ?? []) as { id: string; data: string; rev: number }[]) {
    // Their ids where the tab names them, then the reactions they left on its comments.
    const named = anonymiseJsonText(tab.data, ids);
    const reacted = anonymiseReactionsText(named.value, persons);
    const { value } = reacted;
    if (named.changed || reacted.changed) {
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
        `UPDATE agent_changesets SET author_id = ?1, author_name = ?2
          WHERE design_id = ?3 AND ${isAnySql('author_id', '?4')}`,
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, designId, idList),
    db
      .prepare(`UPDATE design SET owner_id = ?1 WHERE id = ?2 AND ${isAnySql('owner_id', '?3')}`)
      .bind(ANONYMISED_PERSON, designId, idList),
    // Their once-only email claims (@liveworkspace/index-app notify-claims.ts) name them as the sender: the app
    // drops what it keeps for them.
    db.prepare(`DELETE FROM notify_claims WHERE ${isAnySql('sender')}`).bind(idList),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
