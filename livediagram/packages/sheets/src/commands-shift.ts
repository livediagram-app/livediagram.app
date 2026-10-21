// Insert Cells and Delete Cells (docs/specs/029-sheets/sheet.md "Cell menu"): the cells below (or to the right of)
// a range move down (right) to make room for empty ones, or up (left) to close the gap a deleted range leaves.
// Built on the cut-paste move, so every formula that read a moved cell reads it at its new place.
import { clipFromRange } from './clipboard';
import { pasteCut, type PasteResult } from './commands-paste';
import type { Rand } from './ids';
import type { GridRange } from './address';
import type { CellChange } from './store';
import type { Workbook } from './engine/workbook';

export type ShiftMode = 'insertDown' | 'insertRight' | 'deleteUp' | 'deleteLeft';

// The writes that shift, or null when there is nothing to do (an empty sheet beyond the range, nothing to delete).
export function shiftCells(
  wb: Workbook,
  sheetId: string,
  range: GridRange,
  mode: ShiftMode,
  rand: Rand = Math.random,
): PasteResult | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const ext = wb.extent(sheetId);
  const down = mode === 'insertDown' || mode === 'deleteUp';
  const size = down ? range.r2 - range.r1 + 1 : range.c2 - range.c1 + 1;
  const last = (down ? ext.rows : ext.cols) - 1;
  const deleting = mode === 'deleteUp' || mode === 'deleteLeft';
  // The block that moves: from the range's start (insert) or just past its end (delete) to the last filled line.
  const from = deleting ? (down ? range.r2 : range.c2) + 1 : down ? range.r1 : range.c1;
  const block: GridRange | null =
    from > last ? null : down ? { ...range, r1: from, r2: last } : { ...range, c1: from, c2: last };
  // Deleting clears the range itself first (what moves in then lands over it).
  const cleared: CellChange[] = [];
  if (deleting)
    for (let r = range.r1; r <= Math.min(range.r2, ext.rows - 1); r++)
      for (let c = range.c1; c <= Math.min(range.c2, ext.cols - 1); c++) {
        const rowId = sheet.layout.rows[r];
        const colId = sheet.layout.cols[c];
        if (rowId && colId && sheet.cells.has(`${rowId}:${colId}`))
          cleared.push({ r: rowId, c: colId, i: null, f: null });
      }
  const clip = block ? clipFromRange(wb, sheetId, block, true) : null;
  if (!clip) {
    if (!cleared.length) return null;
    return {
      edits: [{ sheetId, write: { kind: 'cells', cells: cleared } }],
      range,
      truncated: false,
    };
  }
  const to = deleting
    ? { r: range.r1, c: range.c1 }
    : down
      ? { r: range.r1 + size, c: range.c1 }
      : { r: range.r1, c: range.c1 + size };
  const moved = pasteCut(wb, sheetId, to, clip, rand);
  if (!moved) return null;
  // The clearing goes first in this sheet's write, so a moved cell landing in the range wins. (Closing a gap never
  // grows the grid, so that write is always a plain cells write.)
  const edits = moved.edits.map((e) =>
    e.sheetId === sheetId && e.write.kind === 'cells'
      ? { ...e, write: { ...e.write, cells: [...cleared, ...e.write.cells] } }
      : e,
  );
  return { edits, range, truncated: moved.truncated };
}
