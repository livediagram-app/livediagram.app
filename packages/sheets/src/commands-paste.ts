// Paste (docs/specs/029-sheets/sheet.md "Clipboard"): the sheet's own cells (formulas shifted by the distance
// moved), cut cells moved (and every formula on the tab pointing at them following), and HTML or text from
// elsewhere read as if typed. A paste past the grid grows it, up to its limits, and says when it was cut.
import type { GridRange } from './address';
import type { Rand } from './ids';
import { makeAxisIds } from './ids';
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';
import { cellKey, type CellFormat, type Sheet, type StoredRef } from './sheet';
import { mapFormulaRefs, shiftForCopy } from './formula/stored';
import { readTypedInput } from './typed-input';
import type { FormatPatch } from './format';
import type { PastedCell, SheetClip } from './clipboard';
import type { CellChange, LayoutChange, SheetWrite } from './store';
import type { Workbook } from './engine/workbook';
import type { Edit } from './commands';

export type PasteMode = 'all' | 'values' | 'formats';

export type PasteResult = { edits: Edit[]; range: GridRange; truncated: boolean };

// The rows and columns the paste needs added at the end, and the target box cut to the limits.
function grow(sheet: Sheet, at: { r: number; c: number }, rows: number, cols: number, rand: Rand) {
  const needRows = Math.max(0, at.r + rows - sheet.layout.rows.length);
  const needCols = Math.max(0, at.c + cols - sheet.layout.cols.length);
  const addRows = Math.min(needRows, SHEET_ROWS_MAX - sheet.layout.rows.length);
  const addCols = Math.min(needCols, SHEET_COLS_MAX - sheet.layout.cols.length);
  const changes: LayoutChange[] = [];
  let rowIds = sheet.layout.rows;
  let colIds = sheet.layout.cols;
  if (addRows > 0) {
    const ids = makeAxisIds(addRows, rand, new Set(rowIds));
    changes.push({ k: 'insertRows', after: rowIds[rowIds.length - 1] ?? null, ids });
    rowIds = [...rowIds, ...ids];
  }
  if (addCols > 0) {
    const ids = makeAxisIds(addCols, rand, new Set(colIds));
    changes.push({ k: 'insertCols', after: colIds[colIds.length - 1] ?? null, ids });
    colIds = [...colIds, ...ids];
  }
  return { changes, rowIds, colIds, truncated: addRows < needRows || addCols < needCols };
}

// How many times the copied block repeats to fill the selection (a whole multiple of it), else once.
function tiles(sel: GridRange, rows: number, cols: number): { rows: number; cols: number } {
  const h = sel.r2 - sel.r1 + 1;
  const w = sel.c2 - sel.c1 + 1;
  const tileRows = h > rows && h % rows === 0 ? h : rows;
  const tileCols = w > cols && w % cols === 0 ? w : cols;
  return { rows: tileRows, cols: tileCols };
}

function write(changes: LayoutChange[], cells: CellChange[]): SheetWrite {
  return changes.length ? { kind: 'layout', changes, cells } : { kind: 'cells', cells };
}

// The sheet's own cells, copied (not cut): formulas shift by the distance moved; Paste Values Only puts the
// values as they show, typed; Paste Formatting Only, formats.
export function pasteClip(
  wb: Workbook,
  sheetId: string,
  sel: GridRange,
  clip: SheetClip,
  mode: PasteMode,
  rand: Rand = Math.random,
): PasteResult | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const size = tiles(sel, clip.rows, clip.cols);
  const g = grow(sheet, { r: sel.r1, c: sel.c1 }, size.rows, size.cols, rand);
  const from = wb.ctxFor(clip.from.sheetId);
  const to = wb.ctxFor(sheetId);
  // The destination's layout after growing, so a formula shifted onto a new row encodes against it.
  const toCtx = g.changes.length
    ? { ...to, own: { ...to.own, layout: { ...to.own.layout, rows: g.rowIds, cols: g.colIds } } }
    : to;
  const cells: CellChange[] = [];
  for (let i = 0; i < size.rows; i++)
    for (let j = 0; j < size.cols; j++) {
      const r = sel.r1 + i;
      const c = sel.c1 + j;
      const rowId = g.rowIds[r];
      const colId = g.colIds[c];
      if (!rowId || !colId) continue;
      const src = clip.cells[i % clip.rows]![j % clip.cols];
      const ch: CellChange = { r: rowId, c: colId };
      if (mode === 'values') {
        const text = clip.values[i % clip.rows]![j % clip.cols]!;
        const read = readTypedInput(text, wb.locale, to, false);
        ch.i = read.kind === 'value' ? read.input : null;
      } else if (mode === 'all') {
        const input = src?.input;
        const dr = r - (clip.from.r + (i % clip.rows));
        const dc = c - (clip.from.c + (j % clip.cols));
        ch.i =
          input && 'f' in input
            ? { f: shiftForCopy(input.f, dr, dc, from, toCtx) }
            : (input ?? null);
      }
      if (mode !== 'values') ch.f = (src?.format ?? null) as FormatPatch | null;
      cells.push(ch);
    }
  return {
    edits: [{ sheetId, write: write(g.changes, cells) }],
    range: {
      r1: sel.r1,
      c1: sel.c1,
      r2: Math.min(sel.r1 + size.rows, g.rowIds.length) - 1,
      c2: Math.min(sel.c1 + size.cols, g.colIds.length) - 1,
    },
    truncated: g.truncated,
  };
}

// Cut cells pasted: they move (no shift), their old place empties, and every formula on the tab that read a moved
// cell (or a range wholly inside the moved block) reads it at its new place.
export function pasteCut(
  wb: Workbook,
  sheetId: string,
  at: { r: number; c: number },
  clip: SheetClip,
  rand: Rand = Math.random,
): PasteResult | null {
  const src = wb.sheet(clip.from.sheetId);
  const dest = wb.sheet(sheetId);
  if (!src || !dest) return null;
  const g = grow(dest, at, clip.rows, clip.cols, rand);
  // Old ids -> new ids, cell by cell.
  const moved = new Map<string, { r: string; c: string }>();
  for (let i = 0; i < clip.rows; i++)
    for (let j = 0; j < clip.cols; j++) {
      const a = { r: src.layout.rows[clip.from.r + i], c: src.layout.cols[clip.from.c + j] };
      const b = { r: g.rowIds[at.r + i], c: g.colIds[at.c + j] };
      if (a.r && a.c && b.r && b.c) moved.set(cellKey(a.r, a.c), { r: b.r, c: b.c });
    }
  const follow = (ref: StoredRef, ownId: string): StoredRef => {
    const target = ref.s ?? (ref.st === undefined ? ownId : undefined);
    if (target !== clip.from.sheetId || ref.r1 === undefined || ref.c1 === undefined) return ref;
    const a = moved.get(cellKey(ref.r1, ref.c1));
    const isRange = ref.r2 !== undefined || ref.c2 !== undefined;
    if (!isRange) return a ? retarget(ref, ownId, a, undefined) : ref;
    if (ref.r2 === undefined || ref.c2 === undefined) return ref;
    const b = moved.get(cellKey(ref.r2, ref.c2));
    return a && b ? retarget(ref, ownId, a, b) : ref;
  };
  const retarget = (
    ref: StoredRef,
    ownId: string,
    a: { r: string; c: string },
    b?: { r: string; c: string },
  ): StoredRef => {
    const out: StoredRef = { ...ref, r1: a.r, c1: a.c, ...(b ? { r2: b.r, c2: b.c } : {}) };
    if (sheetId === ownId) delete out.s;
    else out.s = sheetId;
    return out;
  };
  const bySheet = new Map<string, CellChange[]>();
  const push = (id: string, ch: CellChange) => bySheet.set(id, [...(bySheet.get(id) ?? []), ch]);
  // Clear the old place (unless the new place covers it), then put the moved cells down.
  const landing = new Set([...moved.values()].map((x) => cellKey(x.r, x.c)));
  for (const key of moved.keys())
    if (!(clip.from.sheetId === sheetId && landing.has(key))) {
      const [r, c] = key.split(':') as [string, string];
      push(clip.from.sheetId, { r, c, i: null, f: null });
    }
  for (const [key, to] of moved) {
    const cell = src.cells.get(key);
    const input = cell?.input;
    const i =
      input && 'f' in input
        ? { f: mapFormulaRefs(input.f, (ref) => follow(ref, clip.from.sheetId)) }
        : (input ?? null);
    push(sheetId, { r: to.r, c: to.c, i, f: (cell?.format ?? null) as FormatPatch | null });
  }
  // Formulas elsewhere on the tab that read the moved cells.
  for (const sheet of wb.sheetList()) {
    for (const [key, cell] of sheet.cells) {
      if (sheet.id === clip.from.sheetId && moved.has(key)) continue;
      const input = cell.input;
      if (!input || !('f' in input)) continue;
      const next = mapFormulaRefs(input.f, (ref) => follow(ref, sheet.id));
      if (next === input.f) continue;
      const [r, c] = key.split(':') as [string, string];
      push(sheet.id, { r, c, i: { f: next } });
    }
  }
  const edits: Edit[] = [];
  for (const [id, cells] of bySheet)
    edits.push({ sheetId: id, write: write(id === sheetId ? g.changes : [], cells) });
  if (!bySheet.has(sheetId) && g.changes.length)
    edits.push({ sheetId, write: { kind: 'layout', changes: g.changes } });
  return {
    edits,
    range: { r1: at.r, c1: at.c, r2: at.r + clip.rows - 1, c2: at.c + clip.cols - 1 },
    truncated: g.truncated,
  };
}

// HTML or text from elsewhere (Google Sheets, Excel, a web page): each value read as if typed, with the formats
// the HTML carried.
export function pasteExternal(
  wb: Workbook,
  sheetId: string,
  sel: GridRange,
  rows: readonly (readonly (PastedCell | string)[])[],
  mode: PasteMode,
  rand: Rand = Math.random,
): PasteResult | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet || rows.length === 0) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const size = tiles(sel, rows.length, width);
  const g = grow(sheet, { r: sel.r1, c: sel.c1 }, size.rows, size.cols, rand);
  const ctx = wb.ctxFor(sheetId);
  const toCtx = g.changes.length
    ? { ...ctx, own: { ...ctx.own, layout: { ...ctx.own.layout, rows: g.rowIds, cols: g.colIds } } }
    : ctx;
  const cells: CellChange[] = [];
  for (let i = 0; i < size.rows; i++)
    for (let j = 0; j < size.cols; j++) {
      const rowId = g.rowIds[sel.r1 + i];
      const colId = g.colIds[sel.c1 + j];
      if (!rowId || !colId) continue;
      const raw = rows[i % rows.length]![j % width];
      const cell: PastedCell = typeof raw === 'string' ? { text: raw } : (raw ?? { text: '' });
      const ch: CellChange = { r: rowId, c: colId };
      if (mode !== 'formats') {
        const current = sheet.cells.get(cellKey(rowId, colId))?.format;
        const read = readTypedInput(cell.text, wb.locale, toCtx, current?.nf === 'text');
        ch.i =
          read.kind === 'value' ? read.input : read.kind === 'invalid' ? { s: cell.text } : null;
        if (read.kind === 'value' && read.hint && mode === 'all')
          ch.f = hintFormat(cell.format, read.hint);
        else if (mode === 'all') ch.f = (cell.format ?? null) as FormatPatch | null;
      } else {
        ch.f = (cell.format ?? null) as FormatPatch | null;
      }
      cells.push(ch);
    }
  return {
    edits: [{ sheetId, write: write(g.changes, cells) }],
    range: { r1: sel.r1, c1: sel.c1, r2: sel.r1 + size.rows - 1, c2: sel.c1 + size.cols - 1 },
    truncated: g.truncated,
  };
}

function hintFormat(
  format: CellFormat | undefined,
  hint: { nf: string; cur?: string },
): FormatPatch {
  return { ...(format ?? {}), nf: hint.nf, ...(hint.cur ? { cur: hint.cur } : {}) } as FormatPatch;
}
