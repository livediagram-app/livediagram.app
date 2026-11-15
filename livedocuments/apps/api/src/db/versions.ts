// tab_versions (versions/version-schema.ts): each tab's versions in the document's own SQLite
// (docs/specs/006-document/version-history.md; blueprint "Data and persistence"). The idle copies are the trigger's;
// these are the reads, the copies the api asks for (before an agent's burst, before a restore, a named one), names,
// and the upkeep. Every copy reads the stored row in SQL, so a body is never parsed to be kept.

import {
  VERSION_AGENT_BURST_MS,
  type VersionKind,
  type VersionSummary,
} from '@livedocuments/api-schema';
import type { DocumentEnv } from '../types';

export type VersionAuthor = { id: string; name: string; color: string };

type VersionRow = {
  id: string;
  tab_id: string;
  rev: number;
  kind: VersionKind;
  name: string | null;
  author_name: string | null;
  author_color: string | null;
  tab_name: string;
  bytes: number;
  element_count: number;
  saved_at: number;
  created_at: number;
};

export type StoredVersion = { summary: VersionSummary; tabName: string; data: string };

const SUMMARY_COLUMNS =
  'id, tab_id, rev, kind, name, author_name, author_color, tab_name, bytes, element_count, saved_at, created_at';

// A version id: `v_` and 16 lower-case hex characters, as the schema's SQL_VERSION_ID mints them.
export function versionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `v_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function rowToSummary(row: VersionRow): VersionSummary {
  return {
    id: row.id,
    tabId: row.tab_id,
    rev: row.rev,
    kind: row.kind,
    name: row.name,
    author:
      row.author_name !== null ? { name: row.author_name, color: row.author_color ?? '' } : null,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    bytes: row.bytes,
    elementCount: row.element_count,
  };
}

// A tab's versions, newest content first, without bodies: the rail's list, at most the bounds' 75 rows.
export async function listVersions(env: DocumentEnv, tabId: string): Promise<VersionSummary[]> {
  const res = await env.DOCUMENT_DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM tab_versions WHERE tab_id = ? ORDER BY saved_at DESC, rev DESC`,
  )
    .bind(tabId)
    .all<VersionRow>();
  return (res.results ?? []).map(rowToSummary);
}

// One version of this tab with its body; null when the tab has no such version.
export async function getVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
): Promise<StoredVersion | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT ${SUMMARY_COLUMNS}, data FROM tab_versions WHERE id = ? AND tab_id = ?`,
  )
    .bind(id, tabId)
    .first<VersionRow & { data: string }>();
  return row ? { summary: rowToSummary(row), tabName: row.tab_name, data: row.data } : null;
}

// The version holding this revision of the tab, if one was kept.
export async function versionAtRev(
  env: DocumentEnv,
  tabId: string,
  rev: number,
): Promise<VersionSummary | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM tab_versions WHERE tab_id = ? AND rev = ? LIMIT 1`,
  )
    .bind(tabId, rev)
    .first<VersionRow>();
  return row ? rowToSummary(row) : null;
}

const COPY_COLUMNS =
  'id, tab_id, rev, kind, name, author_id, author_name, author_color, tab_name, data, bytes, element_count, saved_at, created_at';

// The stored tab copied as a version (VH5, VH10): kept only when the tab is still at `rev` and no version holds that
// revision yet, so a lost race keeps nothing and "one per revision" holds.
export function copyTabStatement(
  env: DocumentEnv,
  v: {
    id: string;
    tabId: string;
    rev: number;
    kind: Exclude<VersionKind, 'idle'>;
    name: string | null;
    author: VersionAuthor;
    now: number;
  },
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `INSERT INTO tab_versions (${COPY_COLUMNS})
     SELECT ?, id, rev, ?, ?, ?, ?, ?, name, data, length(CAST(data AS BLOB)), element_count, updated_at, ?
       FROM tabs
      WHERE id = ? AND rev = ?
        AND NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = ? AND rev = ?)`,
  ).bind(
    v.id,
    v.kind,
    v.name,
    v.author.id,
    v.author.name,
    v.author.color,
    v.now,
    v.tabId,
    v.rev,
    v.tabId,
    v.rev,
  );
}

// The version before an agent's burst (VH4): the stored tab, unless that token wrote a changeset on it within
// VERSION_AGENT_BURST_MS, an agent version of the same person was kept on it within that time (a page change writes no
// changeset), or a version already holds its revision. Runs in the changeset's own batch, before the tab
// write, so it copies the tab as the agent found it.
export function agentVersionStatement(
  env: DocumentEnv,
  a: { tabId: string; tokenId: string; author: VersionAuthor; now: number },
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `INSERT INTO tab_versions (${COPY_COLUMNS})
     SELECT ?, t.id, t.rev, 'agent', NULL, ?, ?, ?, t.name, t.data, length(CAST(t.data AS BLOB)),
            t.element_count, t.updated_at, ?
       FROM tabs t
      WHERE t.id = ?
        AND NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = t.id AND rev = t.rev)
        AND NOT EXISTS (SELECT 1 FROM agent_changesets
                         WHERE tab_id = t.id AND token_id = ? AND created_at > ?)
        AND NOT EXISTS (SELECT 1 FROM tab_versions
                         WHERE tab_id = t.id AND kind = 'agent' AND author_id = ? AND created_at > ?)`,
  ).bind(
    versionId(),
    a.author.id,
    a.author.name,
    a.author.color,
    a.now,
    a.tabId,
    a.tokenId,
    a.now - VERSION_AGENT_BURST_MS,
    a.author.id,
    a.now - VERSION_AGENT_BURST_MS,
  );
}

// How many of the tab's versions are named.
export async function namedVersionCount(env: DocumentEnv, tabId: string): Promise<number> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT COUNT(*) AS n FROM tab_versions WHERE tab_id = ? AND name IS NOT NULL',
  )
    .bind(tabId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Names, renames or (null) unnames one of the tab's versions; null when it has no such version.
export async function setVersionName(
  env: DocumentEnv,
  tabId: string,
  id: string,
  name: string | null,
): Promise<VersionSummary | null> {
  const row = await env.DOCUMENT_DB.prepare(
    `UPDATE tab_versions SET name = ? WHERE id = ? AND tab_id = ? RETURNING ${SUMMARY_COLUMNS}`,
  )
    .bind(name, id, tabId)
    .first<VersionRow>();
  return row ? rowToSummary(row) : null;
}

// The daily upkeep (VH6): automatic versions kept before the cutoff, on tabs nobody has edited since.
export async function deleteOldVersions(env: DocumentEnv, cutoff: number): Promise<number> {
  const res = await env.DOCUMENT_DB.prepare(
    'DELETE FROM tab_versions WHERE name IS NULL AND created_at < ?',
  )
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}
