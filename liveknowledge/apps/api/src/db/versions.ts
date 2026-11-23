// tab_versions (versions/version-schema.ts): each tab's versions in the document's own SQLite
// (docs/specs/006-document/version-history.md; blueprint "Data and persistence"). The idle and save copies are the
// triggers';
// these are the reads, the copies the api asks for (before an agent's burst, before a restore, a named one), names,
// and the upkeep. Every copy reads the stored row in SQL, so a body is never parsed to be kept.

import {
  VERSION_AGENT_BURST_MS,
  type VersionKind,
  type VersionSummary,
} from '@liveknowledge/api-schema';
import { AUTOMATION_PERSON_ID } from '@liveworkspace/automations';
import type { DocumentEnv } from '../types';
import {
  countNamedVersions,
  getNamedVersion,
  listNamedVersions,
  namedVersionAtRev,
  renameNamedVersion,
  unnameNamedVersion,
} from './named-versions';

export type VersionAuthor = { id: string; name: string; color: string };

/** A stored author as a version's "by" line: a rule's reads "Automation · <rule>", so it never passes for a person
 *  (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"). */
export function versionAuthorOf(row: {
  author_id: string | null;
  author_name: string | null;
  author_color: string | null;
  // The agent an agent's write kept it for (VH25, VH27); absent from the snapshots' store, which an agent never names.
  author_agent?: string | null;
}): VersionSummary['author'] {
  if (row.author_name === null) return null;
  const name =
    row.author_id === AUTOMATION_PERSON_ID
      ? row.author_name
        ? `Automation · ${row.author_name}`
        : 'Automation'
      : row.author_name;
  return {
    name,
    color: row.author_color ?? '',
    ...(typeof row.author_agent === 'string' && row.author_agent
      ? { agent: row.author_agent }
      : {}),
  };
}

type VersionRow = {
  id: string;
  tab_id: string;
  rev: number;
  kind: VersionKind;
  name: string | null;
  author_id: string | null;
  author_name: string | null;
  author_color: string | null;
  author_agent: string | null;
  tab_name: string;
  bytes: number;
  element_count: number;
  saved_at: number;
  created_at: number;
};

export type StoredVersion = { summary: VersionSummary; tabName: string; data: string };

const SUMMARY_COLUMNS =
  'id, tab_id, rev, kind, name, author_id, author_name, author_color, author_agent, tab_name, bytes, element_count, saved_at, created_at';

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
    author: versionAuthorOf(row),
    savedAt: row.saved_at,
    createdAt: row.created_at,
    bytes: row.bytes,
    elementCount: row.element_count,
  };
}

// VH21: a read of the snapshots' store that fails reads as nothing there, so `tab_versions` always answers.
async function orNothing<T>(read: () => Promise<T>, nothing: T, tabId: string): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.warn('[versions] refused', { tabId, reason: 'store', error: String(err) });
    return nothing;
  }
}

// VH21: a tab's versions from both stores, newest content first, without bodies: one query each, at most the bounds'
// 75 rows between them. An automatic version at a revision a named one in the snapshots' store holds is left out (one
// per revision).
export async function listVersions(env: DocumentEnv, tabId: string): Promise<VersionSummary[]> {
  const [own, named] = await Promise.all([
    listTabVersions(env, tabId),
    orNothing(() => listNamedVersions(env, tabId), [], tabId),
  ]);
  if (named.length === 0) return own;
  const held = new Set(named.map((v) => v.rev));
  return [...own.filter((v) => v.name !== null || !held.has(v.rev)), ...named].sort(
    (a, b) => b.savedAt - a.savedAt || b.rev - a.rev,
  );
}

// The tab's versions in `tab_versions` alone.
async function listTabVersions(env: DocumentEnv, tabId: string): Promise<VersionSummary[]> {
  const res = await env.DOCUMENT_DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM tab_versions WHERE tab_id = ? ORDER BY saved_at DESC, rev DESC`,
  )
    .bind(tabId)
    .all<VersionRow>();
  return (res.results ?? []).map(rowToSummary);
}

// One version of this tab with its body, from either store; null when the tab has no such version.
export async function getVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
): Promise<StoredVersion | null> {
  return (
    (await getTabVersion(env, tabId, id)) ??
    orNothing(() => getNamedVersion(env, tabId, id), null, tabId)
  );
}

async function getTabVersion(
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

// The version holding this revision of the tab, if one was kept: a named one in the snapshots' store first, since the
// list shows it over an automatic one at the same revision.
export async function versionAtRev(
  env: DocumentEnv,
  tabId: string,
  rev: number,
): Promise<VersionSummary | null> {
  return (
    (await orNothing(() => namedVersionAtRev(env, tabId, rev), null, tabId)) ??
    tabVersionAtRev(env, tabId, rev)
  );
}

async function tabVersionAtRev(
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

// The person who pressed Save, on the version the save trigger kept at the revision their save wrote (VH1a): the trigger
// names whoever last wrote the draft, since SQL cannot know who asked. Changes nothing when that save kept no version.
// The tab PUT runs it in the batch that notes the page's writer (knowledge/page-authors.ts notePageWrite), so a Save
// costs no extra round trip.
export function saveVersionStampStatement(
  env: DocumentEnv,
  tabId: string,
  rev: number,
  author: VersionAuthor,
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `UPDATE tab_versions SET author_id = ?, author_name = ?, author_color = ?, author_agent = NULL
      WHERE tab_id = ? AND rev = ? AND kind = 'save'`,
  ).bind(author.id, author.name, author.color, tabId, rev);
}

// VH26: the agent an agent's write was made by, on the versions that write kept (docs/specs/006-document/
// version-history.md "An agent's mark"): the `save` row at the tab's revision now, which the save trigger kept naming
// nobody or a draft's writer, named the token's person with the agent; and that person's `agent` and `restore` rows on
// the tab kept within the burst that name no agent yet, the version before this write. A row already naming an agent
// is left as it is. Rides the batch that notes the page's writer (routes/changesets.ts notePageWriteAfter).
export function agentVersionsStampStatement(
  env: DocumentEnv,
  a: { tabId: string; author: VersionAuthor; agent: string; now: number },
): D1PreparedStatement {
  return env.DOCUMENT_DB.prepare(
    `UPDATE tab_versions
        SET author_agent = ?1,
            author_id = CASE WHEN kind = 'save' THEN ?2 ELSE author_id END,
            author_name = CASE WHEN kind = 'save' THEN ?3 ELSE author_name END,
            author_color = CASE WHEN kind = 'save' THEN ?4 ELSE author_color END
      WHERE tab_id = ?5 AND author_agent IS NULL
        AND ((kind = 'save' AND rev = (SELECT rev FROM tabs WHERE id = ?5))
             OR (kind IN ('agent', 'restore') AND author_id = ?2 AND created_at > ?6))`,
  ).bind(
    a.agent,
    a.author.id,
    a.author.name,
    a.author.color,
    a.tabId,
    a.now - VERSION_AGENT_BURST_MS,
  );
}

// The tab's current revision, without its body; null when there is no such tab.
export async function tabRev(env: DocumentEnv, tabId: string): Promise<number | null> {
  const row = await env.DOCUMENT_DB.prepare('SELECT rev FROM tabs WHERE id = ?')
    .bind(tabId)
    .first<{ rev: number }>();
  return row?.rev ?? null;
}

// How many of the tab's versions are named, in both stores.
export async function namedVersionCount(env: DocumentEnv, tabId: string): Promise<number> {
  const [row, named] = await Promise.all([
    env.DOCUMENT_DB.prepare(
      'SELECT COUNT(*) AS n FROM tab_versions WHERE tab_id = ? AND name IS NOT NULL',
    )
      .bind(tabId)
      .first<{ n: number }>(),
    orNothing(() => countNamedVersions(env, tabId), 0, tabId),
  ]);
  return (row?.n ?? 0) + named;
}

// VH11, VH22: names, renames or (null) unnames one of the tab's versions in whichever store holds it; null when it
// has no such version. Unnaming one in the snapshots' store answers the `tab_versions` row now holding its revision.
export async function nameVersion(
  env: DocumentEnv,
  tabId: string,
  id: string,
  name: string | null,
): Promise<VersionSummary | null> {
  const own = await setVersionName(env, tabId, id, name);
  if (own) return own;
  if (name !== null) return renameNamedVersion(env, tabId, id, name);
  const rev = await unnameNamedVersion(env, tabId, id);
  return rev === null ? null : tabVersionAtRev(env, tabId, rev);
}

// Names, renames or (null) unnames one of the tab's versions in `tab_versions`; null when it has no such version.
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
