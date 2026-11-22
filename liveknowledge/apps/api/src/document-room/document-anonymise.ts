// A closed account's name off a document that outlives them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an
// account"): the index tells the app which documents name them (POST /api/internal/people/:id/purge), and each document's
// Durable Object runs this over what it stores, with @liveworkspace/index-app's anonymiseJsonText: the comments and
// assignments in each tab's elements and articles and in its versions, the changesets they wrote and the versions
// that name them, the email claims they sent, and the
// document's owner when it was their team document. Only rows that mention them are read and rewritten, in
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
import { clearSnapshotAuthors } from '@liveworkspace/snapshots/server';
import { anonymiseNamedVersions } from '../db/named-versions';
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
        `UPDATE tab_versions SET author_id = ?1, author_name = ?2 WHERE ${isAnySql('author_id', '?3')}`,
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, idList),
    db
      .prepare(
        `UPDATE agent_changesets SET author_id = ?1, author_name = ?2
          WHERE document_id = ?3 AND ${isAnySql('author_id', '?4')}`,
      )
      .bind(ANONYMISED_PERSON, ANONYMISED_NAME, documentId, idList),
    db
      .prepare(`UPDATE document SET owner_id = ?1 WHERE id = ?2 AND ${isAnySql('owner_id', '?3')}`)
      .bind(ANONYMISED_PERSON, documentId, idList),
    // Their once-only email claims (notify-claims.ts) name them as the sender: the app drops what it keeps for them.
    db.prepare(`DELETE FROM notify_claims WHERE ${isAnySql('sender')}`).bind(idList),
    // Their reactions on pages (docs/specs/030-knowledgebase/page-reactions.md): a tap, not content, so they go.
    db.prepare(`DELETE FROM page_reactions WHERE ${isAnySql('person')}`).bind(idList),
  );
  const results = await db.batch(writes);
  const versionWrites: D1PreparedStatement[] = [];
  // The versions each tab keeps (docs/specs/006-document/version-history.md) hold the same comments and assignments.
  // Read after the tabs are rewritten: a tab rewrite after a pause keeps the tab as it stood (the idle trigger), so
  // that copy is anonymised here too.
  const versions = await db
    .prepare(`SELECT id, data FROM tab_versions WHERE ${mentionsAnySql('data')}`)
    .bind(needles)
    .all<{ id: string; data: string }>();
  for (const version of versions.results ?? []) {
    const named = anonymiseJsonText(version.data, ids);
    const reacted = anonymiseReactionsText(named.value, persons);
    const { value } = reacted;
    if (named.changed || reacted.changed) {
      versionWrites.push(
        db
          .prepare('UPDATE tab_versions SET data = ?, bytes = ? WHERE id = ?')
          .bind(value, new TextEncoder().encode(value).length, version.id),
      );
    }
  }
  const versionResults = versionWrites.length > 0 ? await db.batch(versionWrites) : [];
  // The snapshots they took here, the document's own and its named versions alike (liveworkspace/docs/specs/
  // 014-snapshots "When an account closes", Work Tracker 1310): the author only.
  const authors = await clearSnapshotAuthors(db, ids, {
    id: ANONYMISED_PERSON,
    name: ANONYMISED_NAME,
  });
  // The named versions' bodies (VH24), last: `tab_versions` is done whatever happens here. A document snapshot's
  // body is the owner's file, and stays.
  const named = await anonymiseNamedVersions(env, {
    needles,
    mentionsSql: mentionsAnySql('c.data'),
    rewrite: (text) => {
      const named = anonymiseJsonText(text, ids);
      const reacted = anonymiseReactionsText(named.value, persons);
      return named.changed || reacted.changed ? reacted.value : null;
    },
  });
  return (
    [...results, ...versionResults].reduce((sum, r) => sum + (r.meta.changes ?? 0), 0) +
    authors +
    named
  );
}
