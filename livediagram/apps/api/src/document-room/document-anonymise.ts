// A closed account's name off a document that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which documents name them (POST /api/internal/people/:id/purge), and each document's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments and
// assignments in each tab's elements, the changesets they wrote, the email claims they sent, and the document's owner
// when it was their team document. Only rows that mention them are read and rewritten, in
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
import type { DocumentEnv } from '../types';

export async function anonymiseDocument(
  env: DocumentEnv,
  documentId: string,
  personId: string,
  guestIds: readonly string[] = [],
): Promise<number> {
  const db = env.DOCUMENT_DB;
  const now = Date.now();
  // Every id they had and its reaction person, each list bound as one JSON parameter (`instr` over it, never a bound
  // LIKE: Durable Object SQLite refuses a LIKE pattern over 50 bytes).
  const ids = closedPersonIds(personId, guestIds);
  const persons = await Promise.all(ids.map((id) => reactionPersonFor(id)));
  const idList = JSON.stringify(ids);
  const needles = JSON.stringify([...ids, ...persons]);
  const tabs = await db
    .prepare(
      `SELECT t.id, t.data, t.rev FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
        WHERE dt.document_id = ?1 AND ${mentionsAnySql('t.data', '?2')}`,
    )
    .bind(documentId, needles)
    .all<{ id: string; data: string; rev: number }>();
  const writes: D1PreparedStatement[] = [];
  for (const tab of tabs.results ?? []) {
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
          WHERE document_id = ?3 AND ${isAnySql('author_id', '?4')}`,
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, documentId, idList),
    db
      .prepare(`UPDATE document SET owner_id = ?1 WHERE id = ?2 AND ${isAnySql('owner_id', '?3')}`)
      .bind(ANONYMISED_PERSON, documentId, idList),
    db.prepare(`DELETE FROM notify_claims WHERE ${isAnySql('sender')}`).bind(idList),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
