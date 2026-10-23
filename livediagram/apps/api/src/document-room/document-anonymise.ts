// A closed account's name off a document that outlives them (liveworkspace/docs/one-explorer-contracts.md "Closing an
// account"): the index tells the app which documents name them (POST /api/internal/people/:id/purge), and each document's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments and
// assignments in each tab's elements, the changesets they wrote, the email claims they sent, and the document's owner
// when it was their team document. Only rows that mention them are read and rewritten, in
// one batch; running it again changes nothing.

import { ANONYMISED_NAME, ANONYMISED_PERSON, anonymiseJsonText } from '@liveworkspace/index-app';
import type { DocumentEnv } from '../types';

export async function anonymiseDocument(
  env: DocumentEnv,
  documentId: string,
  personId: string,
): Promise<number> {
  const db = env.DOCUMENT_DB;
  const now = Date.now();
  const like = `%${personId}%`;
  const tabs = await db
    .prepare(
      `SELECT t.id, t.data, t.rev FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
        WHERE dt.document_id = ? AND t.data LIKE ?`,
    )
    .bind(documentId, like)
    .all<{ id: string; data: string; rev: number }>();
  const writes: D1PreparedStatement[] = [];
  for (const tab of tabs.results ?? []) {
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
        'UPDATE agent_changesets SET author_id = ?, author_name = ? WHERE document_id = ? AND author_id = ?',
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, documentId, personId),
    db
      .prepare('UPDATE document SET owner_id = ? WHERE id = ? AND owner_id = ?')
      .bind(ANONYMISED_PERSON, documentId, personId),
    db.prepare('DELETE FROM notify_claims WHERE sender = ?').bind(personId),
  );
  const results = await db.batch(writes);
  return results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
