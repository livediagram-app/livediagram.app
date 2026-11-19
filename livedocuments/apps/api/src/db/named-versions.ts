// Named versions in the snapshots' store (docs/specs/006-document/version-history.md "Where versions are kept";
// blueprint VH20 to VH24). Name This Version keeps the tab as one `manual` save point of the platform's snapshot
// tables (@liveworkspace/snapshots, SN31 to SN33) under the item id `tab:<tab id>`, so the document's own snapshots
// never see it, with its revision, tab name and element count in `tab_named_versions` (versions/named-store-schema.ts),
// written in the same transaction. `versions.ts` reads this store beside `tab_versions` and merges the two.

import {
  readSnapshotText,
  renameSnapshot,
  rewriteSnapshotText,
  snapshotId,
  takeSnapshot,
} from '@liveworkspace/snapshots/server';
import type { VersionSummary } from '@livedocuments/api-schema';
import type { DocumentEnv } from '../types';
import type { StoredVersion, VersionAuthor } from './versions';

/** The snapshots' item id a tab's named versions live under. */
export const namedScope = (tabId: string): string => `tab:${tabId}`;

type NamedRow = {
  id: string;
  tab_id: string;
  rev: number;
  name: string | null;
  author_name: string | null;
  author_color: string | null;
  tab_name: string;
  bytes: number;
  element_count: number;
  saved_at: number;
  created_at: number;
};

const COLUMNS = `s.id, m.tab_id, m.rev, s.name, s.author_name, s.author_color, m.tab_name, s.bytes, m.element_count,
  m.saved_at, s.created_at`;
const FROM = `FROM tab_named_versions m JOIN snapshots s ON s.id = m.snapshot_id AND s.item_id = 'tab:' || m.tab_id`;

function summaryOf(row: NamedRow): VersionSummary {
  return {
    id: row.id,
    tabId: row.tab_id,
    rev: row.rev,
    kind: 'manual',
    name: row.name,
    author:
      row.author_name !== null ? { name: row.author_name, color: row.author_color ?? '' } : null,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    bytes: row.bytes,
    elementCount: row.element_count,
  };
}

/** The tab's named versions in this store, newest content first, without bodies: one query, at most 25 rows. */
export async function listNamedVersions(
  env: DocumentEnv,
  tabId: string,
): Promise<VersionSummary[]> {
  const res = await env.DOCUMENT_DB.prepare(
    `SELECT ${COLUMNS} ${FROM} WHERE m.tab_id = ? ORDER BY m.saved_at DESC, m.rev DESC`,
  )
    .bind(tabId)
    .all<NamedRow>();
  return (res.results ?? []).map(summaryOf);
}

async function namedRow(env: DocumentEnv, tabId: string, id: string): Promise<NamedRow | null> {
  return env.DOCUMENT_DB.prepare(
    `SELECT ${COLUMNS} ${FROM} WHERE m.snapshot_id = ? AND m.tab_id = ?`,
  )
    .bind(id, tabId)
    .first<NamedRow>();
}

/** One of the tab's named versions with its body; a body whose chunks are short reads as '' (unreadable, as a
 *  `tab_versions` body that no longer parses). */
export async function getNamedVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
): Promise<StoredVersion | null> {
  const row = await namedRow(env, tabId, id);
  if (!row) return null;
  const text = await readSnapshotText(env.DOCUMENT_DB, namedScope(tabId), id);
  return { summary: summaryOf(row), tabName: row.tab_name, data: text ?? '' };
}

/** The named version in this store holding this revision of the tab, if one does. */
export async function namedVersionAtRev(
  env: DocumentEnv,
  tabId: string,
  rev: number,
): Promise<VersionSummary | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT ${COLUMNS} ${FROM} WHERE m.tab_id = ? AND m.rev = ? LIMIT 1`,
  )
    .bind(tabId, rev)
    .first<NamedRow>();
  return row ? summaryOf(row) : null;
}

/** How many named versions the tab keeps in this store. */
export async function countNamedVersions(env: DocumentEnv, tabId: string): Promise<number> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT COUNT(*) AS n FROM tab_named_versions WHERE tab_id = ?',
  )
    .bind(tabId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

type TabRow = {
  rev: number;
  name: string;
  data: string;
  element_count: number;
  updated_at: number;
};

/** VH20, Name This Version: the stored tab, read once, kept as a save point of its tab with its revision row in the
 *  same batch. Undefined for no such tab; null when another version took the revision first (nothing is kept). */
export async function keepNamedVersion(
  env: DocumentEnv,
  v: { tabId: string; name: string; author: VersionAuthor; now: number },
): Promise<VersionSummary | null | undefined> {
  const db = env.DOCUMENT_DB;
  const tab = await db
    .prepare('SELECT rev, name, data, element_count, updated_at FROM tabs WHERE id = ?')
    .bind(v.tabId)
    .first<TabRow>();
  if (!tab) return undefined;
  const taken = await takeSnapshot(db, {
    itemId: namedScope(v.tabId),
    text: tab.data,
    name: v.name,
    kind: 'manual',
    author: v.author,
    now: v.now,
    id: snapshotId(),
    // The route refuses a 26th name: nothing here is ever pruned.
    keep: null,
    alongside: (id) => [
      db
        .prepare(
          `INSERT INTO tab_named_versions (snapshot_id, tab_id, rev, tab_name, element_count, saved_at)
           SELECT ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM tab_named_versions WHERE tab_id = ? AND rev = ?)`,
        )
        .bind(id, v.tabId, tab.rev, tab.name, tab.element_count, tab.updated_at, v.tabId, tab.rev),
      // A version already holding the revision won the race: this save point goes in the same transaction.
      db
        .prepare(
          `DELETE FROM snapshot_chunks WHERE snapshot_id = ?1
             AND NOT EXISTS (SELECT 1 FROM tab_named_versions WHERE snapshot_id = ?1)`,
        )
        .bind(id),
      db
        .prepare(
          `DELETE FROM snapshots WHERE id = ?1
             AND NOT EXISTS (SELECT 1 FROM tab_named_versions WHERE snapshot_id = ?1)`,
        )
        .bind(id),
    ],
  });
  // A tab is capped far under the snapshot cap; a refusal is the store failing.
  if (!taken.ok) throw new Error('named version refused: too large');
  const row = await namedRow(env, v.tabId, taken.snapshot.id);
  return row ? summaryOf(row) : null;
}

/** VH22: a new name for one of the tab's named versions in this store; null when it has no such version. */
export async function renameNamedVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
  name: string,
): Promise<VersionSummary | null> {
  if (!(await renameSnapshot(env.DOCUMENT_DB, namedScope(tabId), id, name))) return null;
  const row = await namedRow(env, tabId, id);
  return row ? summaryOf(row) : null;
}

/** VH22: the name taken off, which makes it an automatic version: its content goes into `tab_versions` under its id,
 *  unless an automatic version already holds the revision (the same content), and its row here goes (the trigger
 *  takes the snapshot rows) in one batch. The revision it held, or null when the tab has no such version. */
export async function unnameNamedVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
): Promise<number | null> {
  const version = await getNamedVersion(env, tabId, id);
  if (!version) return null;
  const { summary } = version;
  const db = env.DOCUMENT_DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO tab_versions (id, tab_id, rev, kind, name, author_id, author_name, author_color, tab_name, data,
                                   bytes, element_count, saved_at, created_at)
         SELECT ?1, ?2, ?3, 'manual', NULL, s.author_id, s.author_name, s.author_color, ?4, ?5, ?6, ?7, ?8, ?9
           FROM snapshots s
          WHERE s.id = ?1
            AND NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = ?2 AND rev = ?3)`,
      )
      .bind(
        id,
        tabId,
        summary.rev,
        version.tabName,
        version.data,
        summary.bytes,
        summary.elementCount,
        summary.savedAt,
        summary.createdAt,
      ),
    db
      .prepare('DELETE FROM tab_named_versions WHERE snapshot_id = ? AND tab_id = ?')
      .bind(id, tabId),
  ]);
  return summary.rev;
}

/** VH24: a closed account's ids off each named version's body that mentions them (a body over one chunk is read
 *  whole, since a mention could straddle a cut). Their name as author comes off with every snapshot's
 *  (`clearSnapshotAuthors`, SN34). */
export async function anonymiseNamedVersions(
  env: DocumentEnv,
  p: {
    needles: string;
    mentionsSql: string;
    rewrite: (text: string) => string | null;
  },
): Promise<number> {
  const db = env.DOCUMENT_DB;
  const candidates = await db
    .prepare(
      `SELECT m.snapshot_id AS id, m.tab_id FROM tab_named_versions m JOIN snapshots s ON s.id = m.snapshot_id
        WHERE s.chunks > 1
           OR EXISTS (SELECT 1 FROM snapshot_chunks c WHERE c.snapshot_id = m.snapshot_id AND ${p.mentionsSql})`,
    )
    .bind(p.needles)
    .all<{ id: string; tab_id: string }>();
  let changes = 0;
  for (const c of candidates.results ?? []) {
    const scope = namedScope(c.tab_id);
    const text = await readSnapshotText(db, scope, c.id);
    if (typeof text !== 'string') continue;
    const next = p.rewrite(text);
    if (next === null) continue;
    // A rewrite is never larger than a take's cap: the text only loses ids for a shorter name.
    await rewriteSnapshotText(db, scope, c.id, next);
    changes += 1;
  }
  return changes;
}
