// A closed account's name off a document that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which documents name them (POST /api/internal/people/:id/purge), and each document's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments and
// assignments in each tab's elements and articles and in its versions, the changesets they wrote and the versions
// that name them, the email claims they sent, and the
// document's owner when it was their team document. Only rows that mention them are read and rewritten, in
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
  // `instr`, never a bound LIKE: Durable Object SQLite refuses a LIKE pattern over 50 bytes.
  const needle = personId;
  const tabs = await db
    .prepare(
      `SELECT t.id, t.data, t.rev FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
        WHERE dt.document_id = ? AND instr(t.data, ?) > 0`,
    )
    .bind(documentId, needle)
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
      .prepare('UPDATE tab_versions SET author_id = ?, author_name = ? WHERE author_id = ?')
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, personId),
    db
      .prepare(
        'UPDATE agent_changesets SET author_id = ?, author_name = ? WHERE document_id = ? AND author_id = ?',
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, documentId, personId),
    db
      .prepare('UPDATE document SET owner_id = ? WHERE id = ? AND owner_id = ?')
      .bind(ANONYMISED_PERSON, documentId, personId),
    // Their once-only email claims (notify-claims.ts) name them as the sender: the app drops what it keeps for them.
    db.prepare('DELETE FROM notify_claims WHERE sender = ?').bind(personId),
  );
  const results = await db.batch(writes);
  const versionWrites: D1PreparedStatement[] = [];
  // The versions each tab keeps (docs/specs/006-document/version-history.md) hold the same comments and assignments.
  // Read after the tabs are rewritten: a tab rewrite after a pause keeps the tab as it stood (the idle trigger), so
  // that copy is anonymised here too.
  const versions = await db
    .prepare('SELECT id, data FROM tab_versions WHERE instr(data, ?) > 0')
    .bind(needle)
    .all<{ id: string; data: string }>();
  for (const version of versions.results ?? []) {
    const { value, changed } = anonymiseJsonText(version.data, personId);
    if (changed) {
      versionWrites.push(
        db
          .prepare('UPDATE tab_versions SET data = ?, bytes = ? WHERE id = ?')
          .bind(value, new TextEncoder().encode(value).length, version.id),
      );
    }
  }
  const versionResults = versionWrites.length > 0 ? await db.batch(versionWrites) : [];
  return [...results, ...versionResults].reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);
}
