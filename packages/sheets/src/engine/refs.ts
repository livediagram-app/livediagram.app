// References as rectangles (blueprint sheets-engine.md "Workbook and recalculation"): a resolved reference, or one
// typed as A1 text (INDIRECT), to the positions it reads on its sheet.
import type { A1Ref } from '../formula/ast';
import type { PosRef } from '../formula/stored';
import type { Frame, RangeRef } from './frame';

// A resolved reference as a rectangle on its sheet: whole columns and rows, and open ends, run to the filled
// extent (never the whole grid), so `SUM(A:A)` reads only rows that hold something.
export function posToRange(pos: PosRef, f: Frame): RangeRef | null {
  let sheetId = f.sheetId;
  if (pos.sheet) {
    if (!('id' in pos.sheet)) return null;
    sheetId = pos.sheet.id;
  }
  const grid = f.grid(sheetId);
  if (!grid) return null;
  // The filled extent is a scan of the sheet's cells, so it is read only for whole and open ranges.
  const needsExtent = pos.r1 === undefined || pos.c1 === undefined || pos.open !== undefined;
  const ext = needsExtent ? f.extent(sheetId) : { rows: 0, cols: 0 };
  let { r1, c1, r2, c2 } = pos;
  if (r1 === undefined) {
    r1 = 0;
    r2 = Math.max(0, ext.rows - 1);
  }
  if (c1 === undefined) {
    c1 = 0;
    c2 = Math.max(0, ext.cols - 1);
  }
  if (pos.open === 'r') r2 = Math.max(r1, ext.rows - 1);
  if (pos.open === 'c') c2 = Math.max(c1, ext.cols - 1);
  // A whole or open range depends on its whole height (or width), not just the filled part it reads, so a value
  // typed below the filled rows still reaches it. Noting the full span costs the same as a short one.
  const wholeRows = pos.r1 === undefined || pos.open === 'r';
  const wholeCols = pos.c1 === undefined || pos.open === 'c';
  if (wholeRows || wholeCols) {
    f.noteRange({
      sheetId,
      r1: wholeRows ? (pos.r1 ?? 0) : Math.min(r1, r2 ?? r1),
      c1: wholeCols ? (pos.c1 ?? 0) : Math.min(c1, c2 ?? c1),
      r2: wholeRows ? grid.rows - 1 : Math.max(r1, r2 ?? r1),
      c2: wholeCols ? grid.cols - 1 : Math.max(c1, c2 ?? c1),
    });
  }
  if (r2 === undefined) r2 = r1;
  if (c2 === undefined) c2 = c1;
  const range = {
    sheetId,
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.min(Math.max(r1, r2), grid.rows - 1),
    c2: Math.min(Math.max(c1, c2), grid.cols - 1),
  };
  if (pos.spill && range.r1 === range.r2 && range.c1 === range.c2) {
    return f.spillOf(sheetId, range.r1, range.c1) ?? range;
  }
  return range;
}

export function a1ToPos(ref: A1Ref, f: Frame): PosRef | null {
  let sheet: PosRef['sheet'] = null;
  if (ref.sheet !== undefined) {
    const h = f.ctx.byTitle(ref.sheet);
    if (!h) return null;
    sheet = h.id === f.sheetId ? null : { id: h.id };
  }
  const out: PosRef = { sheet, a: ref.a };
  if (ref.r1 !== undefined) out.r1 = ref.r1;
  if (ref.c1 !== undefined) out.c1 = ref.c1;
  if (ref.r2 !== undefined) out.r2 = ref.r2;
  if (ref.c2 !== undefined) out.c2 = ref.c2;
  if (ref.open) out.open = ref.open;
  if (ref.spill) out.spill = true;
  return out;
}
