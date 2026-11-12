// The sheet store's writes (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Data and persistence"):
// the statements a batch runs to store cell changes, delete a row or column, write the head, recount and insert, copy
// or delete a sheet, each guarded by the write's rev raise. Split out of sheets.ts, which re-exports them.

import {
  cellKey,
  type CellChange,
  type SheetJson,
  type SheetLayout,
  type SheetPerson,
} from '@liveplanner/sheets';
import type { PlanEnv } from '../types';
import { sheetNoteUnreferencedStatement } from './sheet-refs';

// The cells a JSON array of `row:col` keys (cellKey) names, matched as (row_id, col_id) pairs so the primary key
// seeks each one. Matched on the joined `row_id || ':' || col_id` instead, a write read every cell of the sheet.
// The key splits at its first ':', as readCells splits it.
export function cellsNamedBy(param: string): string {
  return `(row_id, col_id) IN (SELECT substr(value, 1, instr(value, ':') - 1), substr(value, instr(value, ':') + 1)
                                 FROM json_each(${param}))`;
}

// Every statement after the head's rev raise runs only when that raise landed: D1 runs a batch's statements in
// one transaction, but a guarded UPDATE that matched nothing does not stop the rest. The raise stamps the write's
// own nonce, which a stale write's rev + 1 could never fake.
const LANDED = `EXISTS (SELECT 1 FROM sheets WHERE plan_id = ?1 AND id = ?2 AND write_nonce = ?4)`;

// The statements that store `cells` (the landed write's cell changes) under the rev guard: inputs set, format
// patches (a null key clears it, RFC 7396), inputs cleared, then cells left with nothing removed.
export function cellWriteStatements(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  nonce: string,
  cells: readonly CellChange[],
): D1PreparedStatement[] {
  const sets: { r: string; c: string; i: string }[] = [];
  const fmts: { r: string; c: string; fp: string | null }[] = [];
  const clears: string[] = [];
  for (const ch of cells) {
    if (ch.i === null) clears.push(cellKey(ch.r, ch.c));
    else if (ch.i !== undefined) sets.push({ r: ch.r, c: ch.c, i: JSON.stringify(ch.i) });
    if (ch.f !== undefined)
      fmts.push({ r: ch.r, c: ch.c, fp: ch.f === null ? null : JSON.stringify(ch.f) });
  }
  const out: D1PreparedStatement[] = [];
  if (sets.length)
    out.push(
      env.PLAN_DB.prepare(
        `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c', j.value ->> 'i' FROM json_each(?3) j WHERE ${LANDED}
         ON CONFLICT (plan_id, sheet_id, row_id, col_id) DO UPDATE SET input = excluded.input`,
      ).bind(projectId, sheetId, JSON.stringify(sets), nonce),
    );
  if (fmts.length) {
    // Rows first (a format may land on an empty cell), then the patch on the stored format, so a null key in the
    // patch clears that key on a cell that has it.
    out.push(
      env.PLAN_DB.prepare(
        `INSERT OR IGNORE INTO sheet_cells (plan_id, sheet_id, row_id, col_id)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c' FROM json_each(?3) j WHERE ${LANDED}`,
      ).bind(projectId, sheetId, JSON.stringify(fmts), nonce),
      env.PLAN_DB.prepare(
        `UPDATE sheet_cells SET format = (
           SELECT CASE WHEN j.value ->> 'fp' IS NULL THEN NULL
                       ELSE json_patch(COALESCE(sheet_cells.format, '{}'), j.value ->> 'fp') END
             FROM json_each(?3) j
            WHERE j.value ->> 'r' = sheet_cells.row_id AND j.value ->> 'c' = sheet_cells.col_id)
          WHERE plan_id = ?1 AND sheet_id = ?2
            AND (row_id, col_id) IN (SELECT value ->> 'r', value ->> 'c' FROM json_each(?3))
            AND ${LANDED}`,
      ).bind(projectId, sheetId, JSON.stringify(fmts), nonce),
    );
  }
  if (clears.length)
    out.push(
      env.PLAN_DB.prepare(
        `UPDATE sheet_cells SET input = NULL
          WHERE plan_id = ?1 AND sheet_id = ?2 AND ${cellsNamedBy('?3')}
            AND ${LANDED}`,
      ).bind(projectId, sheetId, JSON.stringify(clears), nonce),
    );
  const touched = cells.map((ch) => cellKey(ch.r, ch.c));
  if (touched.length)
    out.push(
      env.PLAN_DB.prepare(
        `DELETE FROM sheet_cells
          WHERE plan_id = ?1 AND sheet_id = ?2 AND input IS NULL AND (format IS NULL OR format = '{}')
            AND ${cellsNamedBy('?3')} AND ${LANDED}`,
      ).bind(projectId, sheetId, JSON.stringify(touched), nonce),
    );
  return out;
}

// Deleted rows' or columns' cells.
export function axisDeleteStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  nonce: string,
  axis: 'r' | 'c',
  ids: readonly string[],
): D1PreparedStatement {
  const col = axis === 'r' ? 'row_id' : 'col_id';
  return env.PLAN_DB.prepare(
    `DELETE FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2 AND ${col} IN (SELECT value FROM json_each(?3))
       AND ${LANDED}`,
  ).bind(projectId, sheetId, JSON.stringify(ids), nonce);
}

// The head's rev raise (and new layout or title), guarded by the rev the write was made against.
export function headWriteStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  fromRev: number,
  nonce: string,
  now: number,
  by: SheetPerson,
  change: { layout?: SheetLayout; title?: string },
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE sheets SET rev = rev + 1, write_nonce = ?, updated_at = ?, updated_by = ?${change.layout ? ', layout = ?' : ''}${
      change.title !== undefined ? ', title = ?' : ''
    }
      WHERE plan_id = ? AND id = ? AND rev = ? RETURNING rev`,
  ).bind(
    nonce,
    now,
    JSON.stringify(by),
    ...(change.layout ? [JSON.stringify(change.layout)] : []),
    ...(change.title !== undefined ? [change.title] : []),
    projectId,
    sheetId,
    fromRev,
  );
}

// The project marked saved (`saved_at`) by a landed write, as a tab write marks it: a Sheet's cells are part of the
// project, so the Explorer's "Updated" line and its snapshot (docs/specs/006-project/project-snapshots.md: a Sheet
// draws its cells) follow them.
export function projectSavedStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  nonce: string,
  now: number,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE plan SET saved_at = MAX(saved_at, ?3) WHERE id = ?1 AND ${LANDED}`,
  ).bind(projectId, sheetId, now, nonce);
}

// Keep cell_count and cell_bytes exact after a write that changes cells beyond the ones it names: rows or columns
// deleted, a sheet inserted or imported. Reads every cell of the sheet, so an ordinary cell write moves the counts by
// delta instead (cellCountDeltaStatement).
export function recountStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(
    `UPDATE sheets SET
       cell_count = (SELECT COUNT(*) FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2),
       cell_bytes = (SELECT COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0)
                       FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2)
     WHERE plan_id = ?1 AND id = ?2`,
  ).bind(projectId, sheetId);
}

// One side of a cell write's count delta, under the write's nonce (blueprint sheet-store.md "Counts"): `sign` -1
// before the cell statements takes the named cells' stored count and bytes off, +1 after them adds back what those
// cells hold now. A cell the write removes is no longer there to add back, a new one was not there to take off, and a
// format SQLite patched is measured as stored, so the counts stay exactly what recountStatement would give. Two
// primary-key lookups per named cell, whatever the sheet's size.
export function cellCountDeltaStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
  nonce: string,
  keys: readonly string[],
  sign: 1 | -1,
): D1PreparedStatement {
  const named = `FROM sheet_cells WHERE plan_id = ?1 AND sheet_id = ?2 AND ${cellsNamedBy('?3')}`;
  return env.PLAN_DB.prepare(
    `UPDATE sheets SET
       cell_count = cell_count + ?5 * (SELECT COUNT(*) ${named}),
       cell_bytes = cell_bytes + ?5 * (SELECT COALESCE(SUM(COALESCE(length(input), 0) + COALESCE(length(format), 0)), 0)
                                         ${named})
     WHERE plan_id = ?1 AND id = ?2 AND write_nonce = ?4`,
  ).bind(projectId, sheetId, JSON.stringify(keys), nonce, sign);
}

// JSON arrays of `items`, each at most about `max` bytes.
function byteChunks<T>(items: readonly T[], max: number): string[] {
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
  env: PlanEnv,
  projectId: string,
  sheet: SheetJson,
  now: number,
): D1PreparedStatement[] {
  const head = env.PLAN_DB.prepare(
    `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    projectId,
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
      env.PLAN_DB.prepare(
        `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format)
         SELECT ?1, ?2, j.value ->> 'r', j.value ->> 'c', j.value -> 'i', j.value -> 'f' FROM json_each(?3) j`,
      ).bind(projectId, sheet.id, chunk),
    );
  out.push(recountStatement(env, projectId, sheet.id));
  out.push(sheetNoteUnreferencedStatement(env, projectId, sheet.id, now));
  return out;
}

// A copy of one of the project's sheets, cells and all, under a new id and title.
export function copySheetStatements(
  env: PlanEnv,
  projectId: string,
  fromId: string,
  to: { id: string; tabId: string; title: string; by: SheetPerson },
  now: number,
): D1PreparedStatement[] {
  return [
    env.PLAN_DB.prepare(
      `INSERT INTO sheets (plan_id, id, tab_id, title, layout, rev, cell_count, cell_bytes, created_at, updated_at, updated_by)
       SELECT plan_id, ?, ?, ?, layout, 0, cell_count, cell_bytes, ?, ?, ? FROM sheets WHERE plan_id = ? AND id = ?`,
    ).bind(to.id, to.tabId, to.title, now, now, JSON.stringify(to.by), projectId, fromId),
    env.PLAN_DB.prepare(
      `INSERT INTO sheet_cells (plan_id, sheet_id, row_id, col_id, input, format)
       SELECT plan_id, ?, row_id, col_id, input, format FROM sheet_cells WHERE plan_id = ? AND sheet_id = ?`,
    ).bind(to.id, projectId, fromId),
    sheetNoteUnreferencedStatement(env, projectId, to.id, now),
  ];
}

export function deleteSheetStatement(
  env: PlanEnv,
  projectId: string,
  sheetId: string,
): D1PreparedStatement {
  return env.PLAN_DB.prepare(`DELETE FROM sheets WHERE plan_id = ? AND id = ?`).bind(
    projectId,
    sheetId,
  );
}
