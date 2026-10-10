// CSV in and out of a sheet (docs/specs/029-sheets/sheet.md "CSV"): Download CSV saves every row and column up to the
// last filled cell, each value as shown; Import CSV reads a file into the sheet (replacing it, or at the
// selection), each value read as typed.
import {
  displayValue,
  parseCsv,
  pasteExternal,
  toCsv,
  clearRanges,
  type GridRange,
  type Sheet,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import { downloadBlob } from '@/lib/download-blob';
import type { SheetController } from './sheet-controller';

export function sheetCsvText(wb: Workbook, sheet: Sheet): string {
  const ext = wb.extent(sheet.id);
  const rows: string[][] = [];
  for (let r = 0; r < ext.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < ext.cols; c++) {
      const cell = sheet.cells.get(`${sheet.layout.rows[r]}:${sheet.layout.cols[c]}`);
      row.push(displayValue(wb.value(sheet.id, r, c), cell?.format, wb.locale).text);
    }
    rows.push(row);
  }
  return toCsv(rows);
}

export function downloadSheetCsv(wb: Workbook, sheet: Sheet): void {
  const name = `${sheet.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Sheet'}.csv`;
  downloadBlob(new Blob([sheetCsvText(wb, sheet)], { type: 'text/csv;charset=utf-8' }), name);
  track('Sheet', 'Exported', 'Csv');
}

export const CSV_TRUNCATED = 'Imported the first 10,000 rows and 200 columns';

// A CSV file's text as the writes that put it in a sheet from `at`, each value read as typed (null for no rows).
export function csvWrites(
  wb: Workbook,
  sheetId: string,
  at: { r: number; c: number },
  text: string,
): { writes: SheetWrite[]; truncated: boolean } | null {
  const parsed = parseCsv(text);
  if (parsed.rows.length === 0) return null;
  const result = pasteExternal(
    wb,
    sheetId,
    { r1: at.r, c1: at.c, r2: at.r, c2: at.c },
    parsed.rows,
    'all',
  );
  if (!result) return null;
  return {
    writes: result.edits.map((e) => e.write),
    truncated: parsed.truncated || result.truncated,
  };
}

// A CSV file's text into the sheet: replacing every cell, or at the selection. Truncation is said in a toast.
export function importCsvText(c: SheetController, text: string, mode: 'replace' | 'insert'): void {
  const g = c.selectionNow().ranges[c.selectionNow().ranges.length - 1]!;
  const at = mode === 'replace' ? { r: 0, c: 0 } : { r: g.r1, c: g.c1 };
  const made = csvWrites(c.workbook, c.sheet.id, at, text);
  if (!made) return;
  const all: GridRange = {
    r1: 0,
    c1: 0,
    r2: c.sheet.layout.rows.length - 1,
    c2: c.sheet.layout.cols.length - 1,
  };
  // Replacing clears the sheet first; either way the import is one change, undone in one step.
  const writes = [
    ...(mode === 'replace' ? [clearRanges(c.sheet, [all], 'all')] : []),
    ...made.writes,
  ];
  if (
    !c.writeAll(
      writes.map((write) => ({ sheetId: c.sheet.id, write })),
      'Paste',
    )
  )
    return;
  if (made.truncated) c.toast(CSV_TRUNCATED);
  track('Sheet', 'Imported', 'Csv');
}
