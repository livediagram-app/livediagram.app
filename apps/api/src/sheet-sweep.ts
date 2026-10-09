// The daily expiry of unreferenced sheets (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint
// sheet-store.md "Deleting a sheet"). Every tab write notes when a sheet stops being referenced
// (db/sheet-refs.ts), so this only reads the sheets past SHEET_UNREFERENCED_DAYS, oldest first, by a partial index:
// its cost follows what expired, never how many tabs or sheets there are. Deleting a sheet deletes its cells (the
// cascade), so a run is bounded by cells: a batch holds at most SHEET_EXPIRY_BATCH_CELLS (always at least one
// sheet), a run at most SHEET_EXPIRY_CELLS_MAX, and what is left waits a day.
import type { Env } from './types';
import { DAY_MS } from '@livediagram/items';

export const SHEET_UNREFERENCED_DAYS = 30;
export const SHEET_EXPIRY_BATCH = 25;
export const SHEET_EXPIRY_BATCH_CELLS = 100_000;
export const SHEET_EXPIRY_CELLS_MAX = 500_000;

type Expired = { document_id: string; id: string; cell_count: number };

export async function runSheetExpiry(
  env: Env,
  now = Date.now(),
): Promise<{ sheets: number; cells: number; more: boolean }> {
  const cutoff = now - SHEET_UNREFERENCED_DAYS * DAY_MS;
  let sheets = 0;
  let cells = 0;
  for (;;) {
    if (cells >= SHEET_EXPIRY_CELLS_MAX) {
      console.info('[sheets] sheets.expired', { sheets, cells, more: true });
      return { sheets, cells, more: true };
    }
    const rows =
      (
        await env.DB.prepare(
          `SELECT document_id, id, cell_count FROM sheets
            WHERE unreferenced_since < ? ORDER BY unreferenced_since LIMIT ?`,
        )
          .bind(cutoff, SHEET_EXPIRY_BATCH)
          .all<Expired>()
      ).results ?? [];
    if (rows.length === 0) break;
    const batch: Expired[] = [];
    let batchCells = 0;
    for (const row of rows) {
      if (batch.length > 0 && batchCells + row.cell_count > SHEET_EXPIRY_BATCH_CELLS) break;
      batch.push(row);
      batchCells += row.cell_count;
    }
    await env.DB.batch(
      batch.map((s) =>
        env.DB.prepare('DELETE FROM sheets WHERE document_id = ? AND id = ?').bind(
          s.document_id,
          s.id,
        ),
      ),
    );
    sheets += batch.length;
    cells += batchCells;
  }
  console.info('[sheets] sheets.expired', { sheets, cells, more: false });
  return { sheets, cells, more: false };
}
