// image_refs + image_refs_backfill: the image reference index
// (docs/specs/009-elements/images.md, "Reference index"). A projection of
// the image elements inside `tabs.data`, so retention, the usage map and
// share-visitor reads never read a tab body.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the
// index lands in the same transaction as the blob it mirrors (the pattern of
// collab-index.ts). There are no foreign keys: a dangling row (its tab gone)
// is ignored by every reader, which is what makes every gap here fail
// towards keeping bytes.

import { IMAGE_REF_ID_MAX_LENGTH } from '../image-refs/extract';
import type { Env } from '../types';

// ---------- Writers ---------------------------------------------------

// A body replace: drop the tab's references the new body no longer has, then
// add the ones it does. A save that changes no image writes no row.
export function imageRefReplaceStatements(
  env: Env,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      'DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, JSON.stringify(ids)),
    ...imageRefAddStatements(env, tabId, ids),
  ];
}

// Add only: for a write that may have lost a race (the Q&A swap, the
// backfill), where deleting could remove a reference the winner wrote.
export function imageRefAddStatements(
  env: Env,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DB.prepare(
      'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
    ).bind(tabId, JSON.stringify(ids)),
  ];
}

export function imageRefPruneTabStatement(env: Env, tabId: string): D1PreparedStatement {
  return env.DB.prepare('DELETE FROM image_refs WHERE tab_id = ?').bind(tabId);
}

// ---------- The extractor, in SQL -------------------------------------

// The SQL twin of image-refs/extract.ts `imageRefIds`, held to it by a parity
// test. Indexes the tabs matching `tabWhere` without a body leaving D1. The
// nested CASE hands json_each an empty object unless the body mentions
// "imageId" at all (D1 bills every element json_each walks, so image-free
// tabs must not be walked; the JavaScript side has the same fast path) and is
// valid JSON with an `elements` ARRAY, so a corrupt tab can't fail the
// statement (in whatever order SQLite evaluates the join) and an object
// isn't walked.
function indexTabsSql(tabWhere: string): string {
  return `INSERT OR IGNORE INTO image_refs (tab_id, image_id)
    SELECT t.id, json_extract(e.value, '$.imageId')
      FROM tabs t,
           json_each(CASE WHEN instr(t.data, '"imageId"') = 0 THEN '{}'
                          WHEN NOT json_valid(t.data) THEN '{}'
                          WHEN json_type(t.data, '$.elements') = 'array' THEN t.data
                          ELSE '{}' END, '$.elements') e
     WHERE (${tabWhere})
       AND e.type = 'object'
       AND json_extract(e.value, '$.type') = 'image'
       AND json_type(e.value, '$.imageId') = 'text'
       AND length(json_extract(e.value, '$.imageId')) BETWEEN 1 AND ${IMAGE_REF_ID_MAX_LENGTH}
       AND substr(json_extract(e.value, '$.imageId'), 1, 5) <> 'data:'`;
}

// Backfill page: tabs with rowid in (fromRowId, toRowId].
export function imageRefIndexPageStatement(
  env: Env,
  fromRowId: number,
  toRowId: number,
): D1PreparedStatement {
  return env.DB.prepare(indexTabsSql('t.rowid > ?1 AND t.rowid <= ?2')).bind(fromRowId, toRowId);
}

// Every tab of the owner's diagrams: the usage map's lazy index while the
// backfill is incomplete.
export function imageRefIndexOwnerStatement(env: Env, ownerId: string): D1PreparedStatement {
  return env.DB.prepare(
    indexTabsSql(
      `t.id IN (SELECT dt.tab_id FROM diagram_tabs dt
                  JOIN diagrams d ON d.id = dt.diagram_id
                 WHERE d.owner_id = ?1)`,
    ),
  ).bind(ownerId);
}

// Every tab of one diagram: the share read's lazy index while the backfill is
// incomplete.
export function imageRefIndexDiagramStatement(env: Env, diagramId: string): D1PreparedStatement {
  return env.DB.prepare(
    indexTabsSql('t.id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id = ?1)'),
  ).bind(diagramId);
}

// ---------- Backfill state --------------------------------------------

export type ImageRefsBackfillRow = {
  created_at: number;
  cursor: number;
  completed_at: number | null;
};

export async function readImageRefsBackfill(env: Env): Promise<ImageRefsBackfillRow | null> {
  return await env.DB.prepare(
    'SELECT created_at, cursor, completed_at FROM image_refs_backfill WHERE id = 1',
  ).first<ImageRefsBackfillRow>();
}

// Start (or restart) the backfill from the first tab.
export async function restartImageRefsBackfill(env: Env, now: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO image_refs_backfill (id, created_at, cursor, completed_at) VALUES (1, ?, 0, NULL)
     ON CONFLICT (id) DO UPDATE SET created_at = excluded.created_at, cursor = 0, completed_at = NULL`,
  )
    .bind(now)
    .run();
}

// A statement, so a page and its cursor land in one batch.
export function imageRefsBackfillAdvanceStatement(env: Env, cursor: number): D1PreparedStatement {
  return env.DB.prepare('UPDATE image_refs_backfill SET cursor = ? WHERE id = 1').bind(cursor);
}

export async function completeImageRefsBackfill(env: Env, now: number): Promise<void> {
  await env.DB.prepare('UPDATE image_refs_backfill SET completed_at = ? WHERE id = 1')
    .bind(now)
    .run();
}

export async function maxTabRowId(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT MAX(rowid) AS max FROM tabs').first<{
    max: number | null;
  }>();
  return row?.max ?? 0;
}

// The next corrupt tab in (fromRowId, toRowId] that mentions an image: read
// one at a time, because a corrupt body can be as large as any other.
export async function nextCorruptTabMentioningImages(
  env: Env,
  fromRowId: number,
  toRowId: number,
): Promise<{ rid: number; id: string; data: string } | null> {
  return await env.DB.prepare(
    `SELECT rowid AS rid, id, data FROM tabs
      WHERE rowid > ? AND rowid <= ? AND NOT json_valid(data) AND instr(data, '"imageId"') > 0
      ORDER BY rowid LIMIT 1`,
  )
    .bind(fromRowId, toRowId)
    .first<{ rid: number; id: string; data: string }>();
}

// Once complete, always complete: remembered for the isolate's life so the
// readers stop asking.
let knownComplete = false;

export async function isImageRefIndexComplete(env: Env): Promise<boolean> {
  if (knownComplete) return true;
  const row = await readImageRefsBackfill(env);
  // A missing row is never complete: the backfill recreates it and starts over.
  knownComplete = row !== null && row.completed_at !== null;
  return knownComplete;
}

export function resetImageRefIndexMemo(): void {
  knownComplete = false;
}
