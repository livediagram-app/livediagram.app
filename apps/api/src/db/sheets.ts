// sheets + sheet_cells (migration 0078): a document's sheet store (docs/specs/029-sheets/sheet-store.md, blueprint
// sheet-store.md "Data and persistence"). Cells are written through `json_each` over one JSON parameter, so a write
// of thousands of cells is a handful of statements whatever D1's 100-parameter cap. Every write is one batch,
// guarded by the sheet's rev: a lost race writes nothing and is retried by the route.

import {
  cellKey,
  type CellChange,
  type Sheet,
  type SheetJson,
  type SheetLayout,
  type SheetPerson,
} from '@livediagram/sheets';
import type { DbStatement } from '@livediagram/runtime';
import type { Runtime } from '../types';
import { sheetNoteUnreferencedStatement } from './sheet-refs';

type SheetRow = {
  id: string;
  tab_id: string;
  title: string;
  layout: string;
  rev: number;
  cell_count: number;
  cell_bytes: number;
  created_at: number;
  updated_at: number;
  updated_by: string;
};

type CellRow = {
  sheet_id: string;
  row_id: string;
  col_id: string;
  input: string | null;
  format: string | null;
};

export type SheetHead = Omit<Sheet, 'cells'> & { cellCount: number; cellBytes: number };

const HEAD_COLUMNS =
  'id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by';
const NOBODY: SheetPerson = { id: '', name: 'Someone', color: '#94a3b8' };

function parseJson<T>(text: string | null, fallback: T): T {
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function headFromRow(row: SheetRow): SheetHead {
  return {
    id: row.id,
    tabId: row.tab_id,
    title: row.title,
    layout: parseJson<SheetLayout>(row.layout, { rows: [], cols: [] }),
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: parseJson(row.updated_by, NOBODY),
    cellCount: row.cell_count,
    cellBytes: row.cell_bytes,
  };
}

function headToJson(head: SheetHead, cells: CellRow[]): SheetJson {
  return {
    id: head.id,
    tabId: head.tabId,
    title: head.title,
    layout: head.layout,
    rev: head.rev,
    createdAt: head.createdAt,
    updatedAt: head.updatedAt,
    updatedBy: head.updatedBy,
    cells: cells.map((c) => ({
      r: c.row_id,
      c: c.col_id,
      ...(c.input ? { i: parseJson(c.input, undefined) } : {}),
      ...(c.format ? { f: parseJson(c.format, undefined) } : {}),
    })),
  };
}

export async function readSheetHead(
  env: Runtime,
  documentId: string,
  sheetId: string,
): Promise<SheetHead | null> {
  const row = await env.db.prepare(
    `SELECT ${HEAD_COLUMNS} FROM sheets WHERE document_id = ? AND id = ?`,
  )
    .bind(documentId, sheetId)
    .first<SheetRow>();
  return row ? headFromRow(row) : null;
}

// The heads of a tab's sheets (titles, for uniqueness and references), or of the whole document.
export async function listSheetHeads(
  env: Runtime,
  documentId: string,
  tabId?: string,
): Promise<SheetHead[]> {
  const rows = await env.db.prepare(
    `SELECT ${HEAD_COLUMNS} FROM sheets WHERE document_id = ?${tabId ? ' AND tab_id = ?' : ''} ORDER BY created_at, id`,
  )
    .bind(...(tabId ? [documentId, tabId] : [documentId]))
    .all<SheetRow>();
  return (rows.results ?? []).map(headFromRow);
}

// Whole sheets, cells included: a tab's, named ones, or the document's.
export async function listSheets(
  env: Runtime,
  documentId: string,
  scope: { tabId?: string; ids?: readonly string[] } = {},
): Promise<SheetJson[]> {
  let heads: SheetHead[];
  if (scope.ids) {
    const rows = await env.db.prepare(
      `SELECT ${HEAD_COLUMNS} FROM sheets WHERE document_id = ? AND id IN (SELECT value FROM json_each(?)) ORDER BY created_at, id`,
    )
      .bind(documentId, JSON.stringify(scope.ids))
      .all<SheetRow>();
    heads = (rows.results ?? []).map(headFromRow);
  } else {
    heads = await listSheetHeads(env, documentId, scope.tabId);
  }
  if (heads.length === 0) return [];
  const cells = await env.db.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE document_id = ? AND sheet_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(documentId, JSON.stringify(heads.map((h) => h.id)))
    .all<CellRow>();
  const bySheet = new Map<string, CellRow[]>();
  for (const c of cells.results ?? [])
    bySheet.set(c.sheet_id, [...(bySheet.get(c.sheet_id) ?? []), c]);
  return heads.map((h) => headToJson(h, bySheet.get(h.id) ?? []));
}

// A sheet's formula cells only: what a deletion needs to shrink ranges (store.ts "shrinkFormulas").
export async function readFormulaCells(
  env: Runtime,
  documentId: string,
  sheetId: string,
): Promise<SheetJson['cells']> {
  const rows = await env.db.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE document_id = ? AND sheet_id = ? AND input LIKE '{"f":%'`,
  )
    .bind(documentId, sheetId)
    .all<CellRow>();
  return (rows.results ?? []).map((c) => ({
    r: c.row_id,
    c: c.col_id,
    i: parseJson(c.input, undefined),
  }));
}

// The stored state of named cells (missing ones come back as just their ids), for a write's answer.
export async function readCells(
  env: Runtime,
  documentId: string,
  sheetId: string,
  keys: readonly string[],
): Promise<SheetJson['cells']> {
  if (keys.length === 0) return [];
  const rows = await env.db.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE document_id = ? AND sheet_id = ? AND row_id || ':' || col_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(documentId, sheetId, JSON.stringify(keys))
    .all<CellRow>();
  const found = new Map((rows.results ?? []).map((c) => [cellKey(c.row_id, c.col_id), c]));
  return keys.map((key) => {
    const c = found.get(key);
    const i = key.indexOf(':');
    return {
      r: key.slice(0, i),
      c: key.slice(i + 1),
      ...(c?.input ? { i: parseJson(c.input, undefined) } : {}),
      ...(c?.format ? { f: parseJson(c.format, undefined) } : {}),
    };
  });
}

// How many of `keys` exist, and their stored bytes, for an exact cap check near the limit.
export async function existingCells(
  env: Runtime,
  documentId: string,
  sheetId: string,
  keys: readonly string[],
): Promise<{ count: number; bytes: number }> {
  const row = await env.db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0) AS b
       FROM sheet_cells
      WHERE document_id = ? AND sheet_id = ? AND row_id || ':' || col_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(documentId, sheetId, JSON.stringify(keys))
    .first<{ n: number; b: number }>();
  return { count: row?.n ?? 0, bytes: row?.b ?? 0 };
}

export async function documentSheetTotals(
  env: Runtime,
  documentId: string,
): Promise<{ sheets: number; cells: number }> {
  const row = await env.db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(cell_count), 0) AS c FROM sheets WHERE document_id = ?`,
  )
    .bind(documentId)
    .first<{ n: number; c: number }>();
  return { sheets: row?.n ?? 0, cells: row?.c ?? 0 };
}

// Every statement after the head's rev raise runs only when that raise landed: D1 runs a batch's statements in
// one transaction, but a guarded UPDATE that matched nothing does not stop the rest. The raise stamps the write's
// own nonce, which a stale write's rev + 1 could never fake.
const LANDED = `EXISTS (SELECT 1 FROM sheets WHERE document_id = ?1 AND id = ?2 AND write_nonce = ?4)`;

// The statements that store `cells` (the landed write's cell changes) under the rev guard: inputs set, format
// patches (a null key clears it, RFC 7396), inputs cleared, then cells left with nothing removed.
export function cellWriteStatements(
  env: Runtime,
  documentId: string,
  sheetId: string,
  nonce: string,
  cells: readonly CellChange[],
): DbStatement[] {
  const sets: { r: string; c: string; i: string }[] = [];
  const fmts: { r: string; c: string; fp: string | null }[] = [];
  const clears: string[] = [];
  for (const ch of cells) {
    if (ch.i === null) clears.push(cellKey(ch.r, ch.c));
    else if (ch.i !== undefined) sets.push({ r: ch.r, c: ch.c, i: JSON.stringify(ch.i) });
    if (ch.f !== undefined)
      fmts.push({ r: ch.r, c: ch.c, fp: ch.f === null ? null : JSON.stringify(ch.f) });
  }
  const out: DbStatement[] = [];
  if (sets.length)
    out.push(
      env.db.prepare(
        `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c', j.value ->> 'i' FROM json_each(?3) j WHERE ${LANDED}
         ON CONFLICT (document_id, sheet_id, row_id, col_id) DO UPDATE SET input = excluded.input`,
      ).bind(documentId, sheetId, JSON.stringify(sets), nonce),
    );
  if (fmts.length) {
    // Rows first (a format may land on an empty cell), then the patch on the stored format, so a null key in the
    // patch clears that key on a cell that has it.
    out.push(
      env.db.prepare(
        `INSERT OR IGNORE INTO sheet_cells (document_id, sheet_id, row_id, col_id)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c' FROM json_each(?3) j WHERE ${LANDED}`,
      ).bind(documentId, sheetId, JSON.stringify(fmts), nonce),
      env.db.prepare(
        `UPDATE sheet_cells SET format = (
           SELECT CASE WHEN j.value ->> 'fp' IS NULL THEN NULL
                       ELSE json_patch(COALESCE(sheet_cells.format, '{}'), j.value ->> 'fp') END
             FROM json_each(?3) j
            WHERE j.value ->> 'r' = sheet_cells.row_id AND j.value ->> 'c' = sheet_cells.col_id)
          WHERE document_id = ?1 AND sheet_id = ?2
            AND row_id || ':' || col_id IN (SELECT (value ->> 'r') || ':' || (value ->> 'c') FROM json_each(?3))
            AND ${LANDED}`,
      ).bind(documentId, sheetId, JSON.stringify(fmts), nonce),
    );
  }
  if (clears.length)
    out.push(
      env.db.prepare(
        `UPDATE sheet_cells SET input = NULL
          WHERE document_id = ?1 AND sheet_id = ?2 AND row_id || ':' || col_id IN (SELECT value FROM json_each(?3))
            AND ${LANDED}`,
      ).bind(documentId, sheetId, JSON.stringify(clears), nonce),
    );
  const touched = cells.map((ch) => cellKey(ch.r, ch.c));
  if (touched.length)
    out.push(
      env.db.prepare(
        `DELETE FROM sheet_cells
          WHERE document_id = ?1 AND sheet_id = ?2 AND input IS NULL AND (format IS NULL OR format = '{}')
            AND row_id || ':' || col_id IN (SELECT value FROM json_each(?3)) AND ${LANDED}`,
      ).bind(documentId, sheetId, JSON.stringify(touched), nonce),
    );
  return out;
}

// Deleted rows' or columns' cells.
export function axisDeleteStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
  nonce: string,
  axis: 'r' | 'c',
  ids: readonly string[],
): DbStatement {
  const col = axis === 'r' ? 'row_id' : 'col_id';
  return env.db.prepare(
    `DELETE FROM sheet_cells WHERE document_id = ?1 AND sheet_id = ?2 AND ${col} IN (SELECT value FROM json_each(?3))
       AND ${LANDED}`,
  ).bind(documentId, sheetId, JSON.stringify(ids), nonce);
}

// The head's rev raise (and new layout or title), guarded by the rev the write was made against.
export function headWriteStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
  fromRev: number,
  nonce: string,
  now: number,
  by: SheetPerson,
  change: { layout?: SheetLayout; title?: string },
): DbStatement {
  return env.db.prepare(
    `UPDATE sheets SET rev = rev + 1, write_nonce = ?, updated_at = ?, updated_by = ?${change.layout ? ', layout = ?' : ''}${
      change.title !== undefined ? ', title = ?' : ''
    }
      WHERE document_id = ? AND id = ? AND rev = ? RETURNING rev`,
  ).bind(
    nonce,
    now,
    JSON.stringify(by),
    ...(change.layout ? [JSON.stringify(change.layout)] : []),
    ...(change.title !== undefined ? [change.title] : []),
    documentId,
    sheetId,
    fromRev,
  );
}

// Keep cell_count and cell_bytes exact after a write.
export function recountStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
): DbStatement {
  return env.db.prepare(
    `UPDATE sheets SET
       cell_count = (SELECT COUNT(*) FROM sheet_cells WHERE document_id = ?1 AND sheet_id = ?2),
       cell_bytes = (SELECT COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0)
                       FROM sheet_cells WHERE document_id = ?1 AND sheet_id = ?2)
     WHERE document_id = ?1 AND id = ?2`,
  ).bind(documentId, sheetId);
}

// JSON arrays of `items`, each at most about `max` bytes.
export function byteChunks<T>(items: readonly T[], max: number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let size = 2;
  for (const item of items) {
    const text = JSON.stringify(item);
    if (cur.length && size + text.length + 1 > max) {
      out.push(`[${cur.join(',')}]`);
      cur = [];
      size = 2;
    }
    cur.push(text);
    size += text.length + 1;
  }
  if (cur.length) out.push(`[${cur.join(',')}]`);
  return out;
}

export function insertSheetStatements(
  env: Runtime,
  documentId: string,
  sheet: SheetJson,
  now: number,
): DbStatement[] {
  const head = env.db.prepare(
    `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    documentId,
    sheet.id,
    sheet.tabId,
    sheet.title,
    JSON.stringify(sheet.layout),
    sheet.rev,
    now,
    now,
    JSON.stringify(sheet.updatedBy),
  );
  const out = [head];
  // Chunks of about 1 MB, so no one parameter nears D1's 2 MB value limit.
  for (const chunk of byteChunks(
    sheet.cells.filter((c) => c.i || c.f),
    1_000_000,
  ))
    out.push(
      env.db.prepare(
        `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input, format)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c', j.value -> 'i', j.value -> 'f' FROM json_each(?3) j`,
      ).bind(documentId, sheet.id, chunk),
    );
  out.push(recountStatement(env, documentId, sheet.id));
  out.push(sheetNoteUnreferencedStatement(env, documentId, sheet.id, now));
  return out;
}

// A copy of one of the document's sheets, cells and all, under a new id and title.
export function copySheetStatements(
  env: Runtime,
  documentId: string,
  fromId: string,
  to: { id: string; tabId: string; title: string; by: SheetPerson },
  now: number,
): DbStatement[] {
  return [
    env.db.prepare(
      `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by)
       SELECT document_id, ?, ?, ?, layout, 0, cell_count, cell_bytes, ?, ?, ? FROM sheets WHERE document_id = ? AND id = ?`,
    ).bind(to.id, to.tabId, to.title, now, now, JSON.stringify(to.by), documentId, fromId),
    env.db.prepare(
      `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input, format)
       SELECT document_id, ?, row_id, col_id, input, format FROM sheet_cells WHERE document_id = ? AND sheet_id = ?`,
    ).bind(to.id, documentId, fromId),
    sheetNoteUnreferencedStatement(env, documentId, to.id, now),
  ];
}

export function deleteSheetStatement(
  env: Runtime,
  documentId: string,
  sheetId: string,
): DbStatement {
  return env.db.prepare(`DELETE FROM sheets WHERE document_id = ? AND id = ?`).bind(
    documentId,
    sheetId,
  );
}

// A document copy's sheets (copyDocument): each source tab's sheets under the copy's id for that tab; the sheet
// ids stay, so the copy's Sheet elements still frame them.
export function copySheetsStatements(
  env: Runtime,
  sourceId: string,
  newId: string,
  tabIdMap: ReadonlyMap<string, string>,
  now: number,
): DbStatement[] {
  return [...tabIdMap].flatMap(([oldTab, newTab]) => [
    env.db.prepare(
      `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by)
       SELECT ?, id, ?, title, layout, 0, cell_count, cell_bytes, created_at, ?, updated_by
         FROM sheets WHERE document_id = ? AND tab_id = ?`,
    ).bind(newId, newTab, now, sourceId, oldTab),
    env.db.prepare(
      `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input, format)
       SELECT ?, c.sheet_id, c.row_id, c.col_id, c.input, c.format
         FROM sheet_cells c JOIN sheets s ON s.document_id = c.document_id AND s.id = c.sheet_id
        WHERE c.document_id = ? AND s.tab_id = ?`,
    ).bind(newId, sourceId, oldTab),
  ]);
}
