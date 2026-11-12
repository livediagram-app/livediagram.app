// sheets + sheet_cells: a project's sheet store (docs/specs/029-sheets/sheet-store.md, blueprint
// sheet-store.md "Data and persistence"). Cells are written through `json_each` over one JSON parameter, so a write
// of thousands of cells is a handful of statements whatever D1's 100-parameter cap. Every write is one batch,
// guarded by the sheet's rev: a lost race writes nothing and is retried by the route.

import {
  cellKey,
  type Sheet,
  type SheetJson,
  type SheetLayout,
  type SheetPerson,
} from '@liveplanner/sheets';
import type { PlanEnv } from '../types';
import { cellsNamedBy } from './sheet-writes';

export * from './sheet-writes';

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
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): Promise<SheetHead | null> {
  const row = await env.PLAN_DB.prepare(
    `SELECT ${HEAD_COLUMNS} FROM sheets WHERE plan_id = ? AND id = ?`,
  )
    .bind(projectId, sheetId)
    .first<SheetRow>();
  return row ? headFromRow(row) : null;
}

// The heads of a tab's sheets (titles, for uniqueness and references), or of the whole project.
export async function listSheetHeads(
  env: PlanEnv,
  projectId: string,
  tabId?: string,
): Promise<SheetHead[]> {
  const rows = await env.PLAN_DB.prepare(
    `SELECT ${HEAD_COLUMNS} FROM sheets WHERE plan_id = ?${tabId ? ' AND tab_id = ?' : ''} ORDER BY created_at, id`,
  )
    .bind(...(tabId ? [projectId, tabId] : [projectId]))
    .all<SheetRow>();
  return (rows.results ?? []).map(headFromRow);
}

// Whole sheets, cells included: a tab's, named ones, or the project's.
export async function listSheets(
  env: PlanEnv,
  projectId: string,
  scope: { tabId?: string; ids?: readonly string[] } = {},
): Promise<SheetJson[]> {
  let heads: SheetHead[];
  if (scope.ids) {
    const rows = await env.PLAN_DB.prepare(
      `SELECT ${HEAD_COLUMNS} FROM sheets WHERE plan_id = ? AND id IN (SELECT value FROM json_each(?)) ORDER BY created_at, id`,
    )
      .bind(projectId, JSON.stringify(scope.ids))
      .all<SheetRow>();
    heads = (rows.results ?? []).map(headFromRow);
  } else {
    heads = await listSheetHeads(env, projectId, scope.tabId);
  }
  if (heads.length === 0) return [];
  const cells = await env.PLAN_DB.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE plan_id = ? AND sheet_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(projectId, JSON.stringify(heads.map((h) => h.id)))
    .all<CellRow>();
  const bySheet = new Map<string, CellRow[]>();
  for (const c of cells.results ?? [])
    bySheet.set(c.sheet_id, [...(bySheet.get(c.sheet_id) ?? []), c]);
  return heads.map((h) => headToJson(h, bySheet.get(h.id) ?? []));
}

// A sheet's formula cells only: what a deletion needs to shrink ranges (store.ts "shrinkFormulas").
export async function readFormulaCells(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): Promise<SheetJson['cells']> {
  const rows = await env.PLAN_DB.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE plan_id = ? AND sheet_id = ? AND input LIKE '{"f":%'`,
  )
    .bind(projectId, sheetId)
    .all<CellRow>();
  return (rows.results ?? []).map((c) => ({
    r: c.row_id,
    c: c.col_id,
    i: parseJson(c.input, undefined),
  }));
}

// The stored state of named cells (missing ones come back as just their ids), for a write's answer.
export async function readCells(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  keys: readonly string[],
): Promise<SheetJson['cells']> {
  if (keys.length === 0) return [];
  const rows = await env.PLAN_DB.prepare(
    `SELECT sheet_id, row_id, col_id, input, format FROM sheet_cells
      WHERE plan_id = ? AND sheet_id = ? AND ${cellsNamedBy('?')}`,
  )
    .bind(projectId, sheetId, JSON.stringify(keys))
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

// The text cells of the named rows, by row then column (a form finds its sheet's header row among the top rows).
export async function readRowTexts(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  rowIds: readonly string[],
): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  if (rowIds.length === 0) return out;
  const rows = await env.PLAN_DB.prepare(
    `SELECT row_id, col_id, input FROM sheet_cells
      WHERE plan_id = ? AND sheet_id = ? AND input IS NOT NULL
        AND row_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(projectId, sheetId, JSON.stringify(rowIds))
    .all<{ row_id: string; col_id: string; input: string }>();
  for (const cell of rows.results ?? []) {
    const i = parseJson<{ s?: unknown } | undefined>(cell.input, undefined);
    if (typeof i?.s !== 'string') continue;
    const row = out.get(cell.row_id) ?? new Map<string, string>();
    row.set(cell.col_id, i.s);
    out.set(cell.row_id, row);
  }
  return out;
}

// The ids of a sheet's first probe window of rows, from its end; each window after it twice the last.
export const USED_ROW_WINDOW = 64;

// The last of `rows` holding a value, as a set of at most that one id (a form's response goes under it): a cell with
// only a format (a banded or boxed look's empty rows) holds none, so a styled sheet's response lands under its last
// value, in view. Probed from the end in windows (USED_ROW_WINDOW, doubling while a window holds none), each row one
// indexed seek that stops at its first value: a response read every cell of a sheet that grew with each response.
export async function lastUsedSheetRow(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  rows: readonly string[],
): Promise<Set<string>> {
  const stmt = env.PLAN_DB.prepare(
    `SELECT value AS row_id FROM json_each(?) AS r
      WHERE EXISTS (SELECT 1 FROM sheet_cells
                     WHERE plan_id = ? AND sheet_id = ? AND row_id = r.value AND input IS NOT NULL)`,
  );
  let end = rows.length;
  for (let size = USED_ROW_WINDOW; end > 0; size *= 2) {
    const window = rows.slice(Math.max(0, end - size), end);
    const found = await stmt
      .bind(JSON.stringify(window), projectId, sheetId)
      .all<{ row_id: string }>();
    const used = new Set((found.results ?? []).map((r) => r.row_id));
    for (let i = window.length - 1; i >= 0; i--)
      if (used.has(window[i]!)) return new Set([window[i]!]);
    end -= window.length;
  }
  return new Set();
}

// How many of `keys` exist, and their stored bytes, for an exact cap check near the limit.
export async function existingCells(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  keys: readonly string[],
): Promise<{ count: number; bytes: number }> {
  const row = await env.PLAN_DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0) AS b
       FROM sheet_cells
      WHERE plan_id = ? AND sheet_id = ? AND ${cellsNamedBy('?')}`,
  )
    .bind(projectId, sheetId, JSON.stringify(keys))
    .first<{ n: number; b: number }>();
  return { count: row?.n ?? 0, bytes: row?.b ?? 0 };
}

export async function projectSheetTotals(
  env: PlanEnv,
  projectId: string,
): Promise<{ sheets: number; cells: number }> {
  const row = await env.PLAN_DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(cell_count), 0) AS c FROM sheets WHERE plan_id = ?`,
  )
    .bind(projectId)
    .first<{ n: number; c: number }>();
  return { sheets: row?.n ?? 0, cells: row?.c ?? 0 };
}
