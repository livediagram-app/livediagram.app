// A sheet's Download CSV (docs/specs/029-sheets/sheet.md "CSV"): every row and column up to the last filled cell, each
// value as shown, made safe for a spreadsheet to open (no field runs as a formula). Pure, so the editor's download
// and the api's data export (docs/specs/015-api/api.md "Internal") write the same text.
import { toCsv } from './csv';
import type { Workbook } from './engine/workbook';
import { displayValue } from './number-format';
import type { Sheet } from './sheet';

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
  return toCsv(rows, { safe: true });
}
