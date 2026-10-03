// agent_changesets and agent_changeset_parts (migration 0066): one row per changeset, its element
// ops, inverse and result lines beside it, one row per part
// (docs/specs/024-agents/blueprints/agent-changesets.md "Data and persistence").

import type { ElementOp } from '@livediagram/document';
import { CHANGESET_MERGE_PAGE, type ChangesetCounts } from '@livediagram/api-schema';
import type { Env } from '../types';

export type ChangesetPart = 'ops' | 'inverse' | 'results';

// Each element a changeset touched, as it found it and as it left it (CS17).
export type ChangesetFingerprints = {
  before: Record<string, string>;
  after: Record<string, string>;
};

export type ChangesetRecord = {
  id: string;
  documentId: string;
  tabId: string;
  rev: number;
  baseRev: number | null;
  authorId: string;
  authorName: string;
  authorColor: string;
  tokenId: string | null;
  summary: string | null;
  fingerprints: ChangesetFingerprints;
  counts: ChangesetCounts;
  createdTab: boolean;
  revertOf: string | null;
  createdAt: number;
};

type ChangesetRow = {
  id: string;
  document_id: string;
  tab_id: string;
  rev: number;
  base_rev: number | null;
  author_id: string;
  author_name: string;
  author_color: string;
  token_id: string | null;
  summary: string | null;
  fingerprints: string;
  added: number;
  changed: number;
  removed: number;
  created_tab: number;
  revert_of: string | null;
  created_at: number;
};

const COLUMNS = `id, document_id, tab_id, rev, base_rev, author_id, author_name, author_color, token_id,
  summary, fingerprints, added, changed, removed, created_tab, revert_of, created_at`;
const PREFIXED = COLUMNS.split(',')
  .map((c) => `c.${c.trim()}`)
  .join(', ');

function rowToRecord(row: ChangesetRow): ChangesetRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    tabId: row.tab_id,
    rev: row.rev,
    baseRev: row.base_rev,
    authorId: row.author_id,
    authorName: row.author_name,
    authorColor: row.author_color,
    tokenId: row.token_id,
    summary: row.summary,
    fingerprints: parseFingerprints(row.fingerprints),
    counts: { added: row.added, changed: row.changed, removed: row.removed },
    createdTab: row.created_tab === 1,
    revertOf: row.revert_of,
    createdAt: row.created_at,
  };
}

function parseFingerprints(json: string): ChangesetFingerprints {
  const parsed = JSON.parse(json) as Partial<ChangesetFingerprints> | null;
  return { before: parsed?.before ?? {}, after: parsed?.after ?? {} };
}

export function insertChangesetStatement(env: Env, r: ChangesetRecord): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO agent_changesets (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    r.id,
    r.documentId,
    r.tabId,
    r.rev,
    r.baseRev,
    r.authorId,
    r.authorName,
    r.authorColor,
    r.tokenId,
    r.summary,
    JSON.stringify(r.fingerprints),
    r.counts.added,
    r.counts.changed,
    r.counts.removed,
    r.createdTab ? 1 : 0,
    r.revertOf,
    r.createdAt,
  );
}

export function insertChangesetPartStatement(
  env: Env,
  changesetId: string,
  part: ChangesetPart,
  data: string,
): D1PreparedStatement {
  return env.DB.prepare(
    'INSERT INTO agent_changeset_parts (changeset_id, part, data) VALUES (?, ?, ?)',
  ).bind(changesetId, part, data);
}

// The revision of the tab's latest changeset: the relay's `prevRev` (CS21). Null when none.
export async function lastChangesetRev(env: Env, tabId: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT MAX(rev) AS rev FROM agent_changesets WHERE tab_id = ?')
    .bind(tabId)
    .first<{ rev: number | null }>();
  return row?.rev ?? null;
}

// One changeset of this document; null when the document holds no such record.
export async function getChangeset(
  env: Env,
  documentId: string,
  changesetId: string,
): Promise<ChangesetRecord | null> {
  const row = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM agent_changesets WHERE id = ? AND document_id = ?`,
  )
    .bind(changesetId, documentId)
    .first<ChangesetRow>();
  return row ? rowToRecord(row) : null;
}

export async function getChangesetPart(
  env: Env,
  changesetId: string,
  part: ChangesetPart,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT data FROM agent_changeset_parts WHERE changeset_id = ? AND part = ?',
  )
    .bind(changesetId, part)
    .first<{ data: string }>();
  return row?.data ?? null;
}

// A document's changesets, newest first (CS26).
export async function listChangesets(
  env: Env,
  documentId: string,
  opts: { tabId?: string; limit: number },
): Promise<ChangesetRecord[]> {
  const byTab = opts.tabId !== undefined;
  const res = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM agent_changesets
      WHERE document_id = ?${byTab ? ' AND tab_id = ?' : ''}
      ORDER BY created_at DESC, rev DESC
      LIMIT ?`,
  )
    .bind(...(byTab ? [documentId, opts.tabId, opts.limit] : [documentId, opts.limit]))
    .all<ChangesetRow>();
  return (res.results ?? []).map(rowToRecord);
}

export type MergeEntry = { record: ChangesetRecord; ops: ElementOp[] };

// The changesets a save must merge (docs/specs/024-agents/agent-changesets.md "The write path"
// step 8): this tab's records after the revision the editor has seen, or, for a save without one,
// those newer than `since`; ascending by revision, each with its element ops, in pages of
// CHANGESET_MERGE_PAGE so a long-offline editor never holds them all at once (CS18). Keyed by tab,
// not document: a tab linked into several documents merges every one of its changesets.
export async function* changesetMergePages(
  env: Env,
  tabId: string,
  after: { afterRev: number } | { since: number },
): AsyncGenerator<MergeEntry[]> {
  let floor = 'afterRev' in after ? after.afterRev : -1;
  const since = 'since' in after ? after.since : null;
  for (;;) {
    const res = await env.DB.prepare(
      `SELECT ${PREFIXED}, p.data AS ops
         FROM agent_changesets c
         JOIN agent_changeset_parts p ON p.changeset_id = c.id AND p.part = 'ops'
        WHERE c.tab_id = ? AND c.rev > ?${since === null ? '' : ' AND c.created_at > ?'}
        ORDER BY c.rev
        LIMIT ?`,
    )
      .bind(
        ...(since === null
          ? [tabId, floor, CHANGESET_MERGE_PAGE]
          : [tabId, floor, since, CHANGESET_MERGE_PAGE]),
      )
      .all<ChangesetRow & { ops: string }>();
    const rows = res.results ?? [];
    if (rows.length === 0) return;
    yield rows.map((row) => ({
      record: rowToRecord(row),
      ops: JSON.parse(row.ops) as ElementOp[],
    }));
    if (rows.length < CHANGESET_MERGE_PAGE) return;
    floor = rows[rows.length - 1]!.rev;
  }
}

// The daily retention sweep (CS28): records older than the cutoff; their parts follow by cascade.
export async function deleteOldChangesets(env: Env, cutoff: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM agent_changesets WHERE created_at < ?')
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}
