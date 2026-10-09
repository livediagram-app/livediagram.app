// One sheet's cells for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP read_sheet and `sheet get`): a
// range's non-empty cells by A1, each with its input as typed (a formula with its =), the value the engine works
// out and what the cell shows, plus the layout facts a reader needs (freeze, merges, filter). Bounded twice: the
// range by AGENT_READ_CELLS_MAX cells, the answer by SHEET_READ_CHARS_MAX characters.
import type { ApiClient } from '@livediagram/api-client';
import {
  formatA1,
  formatRange,
  parseRangeText,
  posRangeOf,
  readRange,
  type SheetLayout,
} from '@livediagram/sheets';
import { readSheets, resolveSheet, workbookFor, type SheetRefusal } from './sheet-state';

// The most characters of cells one read answers with (blueprint sheet-store.md, Defaults): about 25,000 tokens, so
// a read fits beside the rest of a conversation.
export const SHEET_READ_CHARS_MAX = 100_000;

export interface ReadCell {
  at: string;
  // As typed: a formula with its =, a number unformatted, a boolean in capitals; empty for a spilled cell.
  input: string;
  // What the engine works out: a number (dates and times as serial numbers), text, a boolean, an error as its
  // text (#REF!), or null.
  value: string | number | boolean | null;
  // What the cell shows, in its number format.
  display: string;
}

export interface SheetRead {
  ok: true;
  sheetId: string;
  title: string;
  tabId: string;
  range: string;
  // Rows and columns in use (to the last cell with an input).
  rows: number;
  cols: number;
  cells: ReadCell[];
  truncated: boolean;
  note?: string;
  frozen: { rows: number; cols: number };
  merges: string[];
  filter: string | null;
}

function layoutFacts(layout: SheetLayout) {
  const a1 = (ids: Parameters<typeof posRangeOf>[1]) => {
    const pos = posRangeOf(layout, ids);
    return pos ? formatRange(pos) : null;
  };
  return {
    frozen: { rows: layout.frozenRows ?? 0, cols: layout.frozenCols ?? 0 },
    merges: (layout.merges ?? []).map(a1).filter((m): m is string => m !== null),
    filter: layout.filter ? a1(layout.filter) : null,
  };
}

export async function readSheet(
  api: ApiClient,
  documentId: string,
  input: { sheet: string; range?: string },
): Promise<SheetRead | SheetRefusal> {
  const sheets = await readSheets(api, documentId);
  const found = resolveSheet(sheets, input.sheet);
  if (!found.ok) return found;
  const { id, tabId, title } = found.sheet;
  const wb = await workbookFor(api, documentId, sheets, tabId);
  const read = readRange(wb, id, input.range);
  if (!read.ok)
    return {
      ok: false,
      code: read.error,
      message: `"${input.range}" is not a cell or range in A1 form ("B4", "A1:D20").`,
    };
  const start = parseRangeText(read.range)!;
  const cells: ReadCell[] = [];
  let chars = 0;
  let cut: string | null = null;
  read.rows.forEach((row, i) => {
    if (cut) return;
    row.forEach((cell, j) => {
      if (cut || (cell.input === '' && (cell.value === null || cell.value === ''))) return;
      const at = formatA1(start.r1 + i, start.c1 + j);
      const out: ReadCell = {
        at,
        input: cell.input,
        // readRange answers an error as its text, so a value is never an error object.
        value: cell.value as ReadCell['value'],
        display: cell.display,
      };
      chars += JSON.stringify(out).length;
      if (chars > SHEET_READ_CHARS_MAX) cut = at;
      else cells.push(out);
    });
  });
  const extent = wb.extent(id);
  const lastRow = start.r1 + read.rows.length;
  const note = cut
    ? `Stopped at ${cut}, the most one read answers with: read on with a range from ${cut}.`
    : read.truncated
      ? `Stopped after row ${lastRow}, the most cells one read answers with: read on with a range from row ${lastRow + 1}.`
      : undefined;
  return {
    ok: true,
    sheetId: id,
    title,
    tabId,
    range: read.range,
    rows: extent.rows,
    cols: extent.cols,
    cells,
    truncated: cut !== null || read.truncated,
    ...(note ? { note } : {}),
    ...layoutFacts(wb.sheet(id)!.layout),
  };
}
