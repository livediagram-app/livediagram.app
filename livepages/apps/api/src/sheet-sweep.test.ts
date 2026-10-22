import { beforeEach, describe, expect, it } from 'vitest';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import {
  runSheetExpiry,
  SHEET_EXPIRY_BATCH_CELLS,
  SHEET_EXPIRY_CELLS_MAX,
  SHEET_UNREFERENCED_DAYS,
} from './sheet-sweep';

// The daily expiry (docs/specs/029-sheets/sheet-store.md "Deleting a sheet"): only sheets unreferenced for 30 days,
// oldest first, bounded by cells per batch and per run.

let sql: SqliteD1;
const DAY = 86_400_000;
const now = 100 * DAY;
const old = now - SHEET_UNREFERENCED_DAYS * DAY - 1;

const sheetRow = (id: string, since: number | null, cells = 0) =>
  sql.sql
    .prepare(
      `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, cell_count, unreferenced_since, created_at, updated_at, updated_by)
       VALUES ('d1', ?, 't1', ?, '{"rows":[],"cols":[]}', 0, ?, ?, 1, 1, '{}')`,
    )
    .run(id, id, cells, since);
const ids = () =>
  (sql.sql.prepare('SELECT id FROM sheets ORDER BY id').all() as { id: string }[]).map((r) => r.id);

beforeEach(() => {
  sql = sqliteD1();
  sql.sql.exec(
    `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'o', 'D', 0, 1, 1);`,
  );
});

describe('the sheet expiry', () => {
  it('deletes only sheets unreferenced for 30 days, with their cells', async () => {
    sheetRow('kept0000', null);
    sheetRow('recent00', now - DAY);
    sheetRow('expired0', old, 1);
    sql.sql.exec(
      `INSERT INTO sheet_cells (document_id, sheet_id, row_id, col_id, input) VALUES ('d1', 'expired0', 'r', 'c', '1')`,
    );
    expect(await runSheetExpiry(sql.env, now)).toEqual({ sheets: 1, cells: 1, more: false });
    expect(ids()).toEqual(['kept0000', 'recent00']);
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM sheet_cells').get()).toEqual({ n: 0 });
  });

  it('stops at the run’s cells and leaves the rest, oldest first, for the next day', async () => {
    const full = SHEET_EXPIRY_BATCH_CELLS / 2;
    const count = SHEET_EXPIRY_CELLS_MAX / full + 2;
    for (let i = 0; i < count; i++)
      sheetRow(`s${String(i).padStart(7, '0')}`, old - count + i, full);
    const first = await runSheetExpiry(sql.env, now);
    expect(first).toEqual({
      sheets: SHEET_EXPIRY_CELLS_MAX / full,
      cells: SHEET_EXPIRY_CELLS_MAX,
      more: true,
    });
    expect(ids()).toEqual([
      `s${String(count - 2).padStart(7, '0')}`,
      `s${String(count - 1).padStart(7, '0')}`,
    ]);
    expect(await runSheetExpiry(sql.env, now)).toEqual({ sheets: 2, cells: 2 * full, more: false });
    expect(ids()).toEqual([]);
  });

  it('deletes a sheet bigger than a batch on its own', async () => {
    sheetRow('huge0000', old - 1, SHEET_EXPIRY_BATCH_CELLS + 1);
    sheetRow('small000', old, 1);
    expect(await runSheetExpiry(sql.env, now)).toEqual({
      sheets: 2,
      cells: SHEET_EXPIRY_BATCH_CELLS + 2,
      more: false,
    });
  });
});
