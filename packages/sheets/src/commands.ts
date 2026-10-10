// What the toolbar, the menus and the keys do to cells (docs/specs/029-sheets/sheet.md "Editing", "Formatting",
// "Fill"), as pure builders from the selection to a write. The editor sends what these return; nothing here sends.
import type { CellPos, GridRange } from './address';
import { fillSeries } from './fill';
import type { FormatPatch } from './format';
import { layoutIndex, posRangeOf } from './layout';
import { SHEET_WRITE_BYTES_MAX, SHEET_WRITE_CELLS_MAX } from './limits';
import { cellKey, splitCellKey, type Border, type Cell, type IdRange, type Sheet } from './sheet';
import { shiftForCopy } from './formula/stored';
import { readTypedInput, type TypedRead } from './typed-input';
import type { CellChange, SheetWrite } from './store';
import type { Workbook } from './engine/workbook';

export type Edit = { sheetId: string; write: SheetWrite };

// The positions a range really covers: a range of whole rows or columns stops at the filled extent, so formatting
// column A formats the cells in use, never all 10,000.
export function boundedRange(
  range: GridRange,
  sheet: Sheet,
  extent: { rows: number; cols: number },
): GridRange {
  const fullRows = range.r1 === 0 && range.r2 >= sheet.layout.rows.length - 1;
  const fullCols = range.c1 === 0 && range.c2 >= sheet.layout.cols.length - 1;
  return {
    r1: range.r1,
    c1: range.c1,
    r2: fullRows ? Math.max(range.r1, Math.min(range.r2, extent.rows - 1)) : range.r2,
    c2: fullCols ? Math.max(range.c1, Math.min(range.c2, extent.cols - 1)) : range.c2,
  };
}

function idsAt(sheet: Sheet, r: number, c: number): { r: string; c: string } | null {
  const rowId = sheet.layout.rows[r];
  const colId = sheet.layout.cols[c];
  return rowId && colId ? { r: rowId, c: colId } : null;
}

// The existing cells inside ranges (iterating the cells, not the grid, so whole columns cost what is filled).
function cellsIn(
  sheet: Sheet,
  ranges: readonly GridRange[],
): { key: string; r: string; c: string; cell: Cell }[] {
  const ix = layoutIndex(sheet.layout);
  const out: { key: string; r: string; c: string; cell: Cell }[] = [];
  for (const [key, cell] of sheet.cells) {
    const { r, c } = splitCellKey(key);
    const rp = ix.rowPos.get(r);
    const cp = ix.colPos.get(c);
    if (rp === undefined || cp === undefined) continue;
    if (ranges.some((g) => rp >= g.r1 && rp <= g.r2 && cp >= g.c1 && cp <= g.c2))
      out.push({ key, r, c, cell });
  }
  return out;
}

export type TypeResult =
  | { ok: true; write: SheetWrite; read: TypedRead }
  | { ok: false; read: Extract<TypedRead, { kind: 'invalid' }> };

// What a person typed, into one cell: read as typed, with its format hint (12% makes the cell Percent) when the
// cell's own number format is Automatic.
export function typeInto(
  wb: Workbook,
  sheetId: string,
  pos: CellPos,
  text: string,
): TypeResult | null {
  const sheet = wb.sheet(sheetId);
  const ids = sheet && idsAt(sheet, pos.r, pos.c);
  if (!sheet || !ids) return null;
  const format = sheet.cells.get(cellKey(ids.r, ids.c))?.format;
  const read = readTypedInput(text, wb.locale, wb.ctxFor(sheetId), format?.nf === 'text');
  if (read.kind === 'invalid') return { ok: false, read };
  const change: CellChange = { ...ids, i: read.kind === 'clear' ? null : read.input };
  if (read.kind === 'value' && read.hint && (!format?.nf || format.nf === 'auto'))
    change.f = {
      nf: read.hint.nf,
      ...(read.hint.cur ? { cur: read.hint.cur } : {}),
    } as FormatPatch;
  return { ok: true, write: { kind: 'cells', cells: [change] }, read };
}

// Ctrl+Enter: the input into every selected cell, a formula's relative references moving with each cell.
export function typeIntoRanges(
  wb: Workbook,
  sheetId: string,
  active: CellPos,
  ranges: readonly GridRange[],
  text: string,
): TypeResult | null {
  const first = typeInto(wb, sheetId, active, text);
  const sheet = wb.sheet(sheetId);
  if (!first || !first.ok || !sheet) return first;
  const base = (first.write as { cells: CellChange[] }).cells[0]!;
  const ctx = wb.ctxFor(sheetId);
  const cells: CellChange[] = [];
  for (const g of ranges)
    for (let r = g.r1; r <= g.r2; r++)
      for (let c = g.c1; c <= g.c2; c++) {
        const ids = idsAt(sheet, r, c);
        if (!ids) continue;
        const i =
          base.i && 'f' in base.i
            ? { f: shiftForCopy(base.i.f, r - active.r, c - active.c, ctx) }
            : base.i;
        cells.push({ ...ids, i, ...(base.f ? { f: base.f } : {}) });
      }
  return { ...first, write: { kind: 'cells', cells } };
}

// Delete / Backspace (inputs), Clear Formatting (formats), Clear (both).
export function clearRanges(
  sheet: Sheet,
  ranges: readonly GridRange[],
  what: 'inputs' | 'formats' | 'all',
): SheetWrite {
  const cells: CellChange[] = [];
  for (const { r, c, cell } of cellsIn(sheet, ranges)) {
    if (what !== 'formats' && cell.input)
      cells.push({ r, c, i: null, ...(what === 'all' ? { f: null } : {}) });
    else if (what !== 'inputs' && cell.format) cells.push({ r, c, f: null });
  }
  return { kind: 'cells', cells };
}

export function formatRanges(
  wb: Workbook,
  sheetId: string,
  ranges: readonly GridRange[],
  patch: FormatPatch,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const extent = wb.extent(sheetId);
  const cells: CellChange[] = [];
  for (const raw of ranges) {
    const g = boundedRange(raw, sheet, extent);
    for (let r = g.r1; r <= g.r2; r++)
      for (let c = g.c1; c <= g.c2; c++) {
        const ids = idsAt(sheet, r, c);
        if (ids) cells.push({ ...ids, f: patch });
      }
  }
  return { kind: 'cells', cells };
}

// More or fewer decimals, from the active cell's current count.
export function stepDecimals(
  current: number | undefined,
  kindIsAuto: boolean,
  sample: number | null,
  delta: 1 | -1,
) {
  let base = current;
  if (base === undefined) {
    if (kindIsAuto && sample !== null) {
      const t = String(sample);
      base = t.includes('.') ? t.length - t.indexOf('.') - 1 : 0;
    } else base = 2;
  }
  return Math.max(0, Math.min(10, base + delta));
}

export type BorderMode = 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none';

// Borders for a range: each cell gets the sides the mode gives it (inner lines on both neighbours' shared sides).
export function borderRange(
  wb: Workbook,
  sheetId: string,
  range: GridRange,
  mode: BorderMode,
  border: Border,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const g = boundedRange(range, sheet, wb.extent(sheetId));
  const cells: CellChange[] = [];
  for (let r = g.r1; r <= g.r2; r++)
    for (let c = g.c1; c <= g.c2; c++) {
      const ids = idsAt(sheet, r, c);
      if (!ids) continue;
      const top = r === g.r1;
      const bottom = r === g.r2;
      const left = c === g.c1;
      const right = c === g.c2;
      const sides = {
        bt:
          mode === 'all' ||
          (mode === 'outer' && top) ||
          (mode === 'top' && top) ||
          (mode === 'inner' && !top),
        bb:
          mode === 'all' ||
          (mode === 'outer' && bottom) ||
          (mode === 'bottom' && bottom) ||
          (mode === 'inner' && !bottom),
        bl:
          mode === 'all' ||
          (mode === 'outer' && left) ||
          (mode === 'left' && left) ||
          (mode === 'inner' && !left),
        br:
          mode === 'all' ||
          (mode === 'outer' && right) ||
          (mode === 'right' && right) ||
          (mode === 'inner' && !right),
      };
      const f: FormatPatch = {};
      for (const [k, on] of Object.entries(sides) as [keyof typeof sides, boolean][]) {
        if (mode === 'none') f[k] = null;
        else if (on) f[k] = border;
      }
      if (Object.keys(f).length) cells.push({ ...ids, f });
    }
  return { kind: 'cells', cells };
}

// Merge: one cell from the range (the top-left keeps its input), or each row of it (across). `needsConfirm` when
// cells other than the kept ones hold an input, which merging clears.
export function mergeRange(
  sheet: Sheet,
  range: GridRange,
  mode: 'all' | 'across',
): { write: SheetWrite; needsConfirm: boolean } | null {
  const rows =
    mode === 'all'
      ? [[range.r1, range.r2]]
      : Array.from({ length: range.r2 - range.r1 + 1 }, (_, i) => [range.r1 + i, range.r1 + i]);
  const changes: SheetWrite & { kind: 'layout' } = { kind: 'layout', changes: [], cells: [] };
  let needsConfirm = false;
  for (const [r1, r2] of rows) {
    if (r1 === r2 && range.c1 === range.c2) continue;
    const a = idsAt(sheet, r1!, range.c1);
    const b = idsAt(sheet, r2!, range.c2);
    if (!a || !b) return null;
    const id: IdRange = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
    // A merge over an existing one replaces it.
    for (const m of sheet.layout.merges ?? []) {
      const p = posRangeOf(sheet.layout, m);
      if (p && p.r1 <= r2! && r1! <= p.r2 && p.c1 <= range.c2 && range.c1 <= p.c2)
        changes.changes.push({ k: 'unmerge', range: m });
    }
    changes.changes.push({ k: 'merge', range: id });
    for (const { r, c, cell } of cellsIn(sheet, [
      { r1: r1!, c1: range.c1, r2: r2!, c2: range.c2 },
    ])) {
      if (r === a.r && c === a.c) continue;
      if (cell.input) {
        needsConfirm = true;
        changes.cells!.push({ r, c, i: null });
      }
    }
  }
  if (changes.changes.length === 0) return null;
  return { write: changes, needsConfirm };
}

export function unmergeRange(sheet: Sheet, range: GridRange): SheetWrite | null {
  const changes = (sheet.layout.merges ?? [])
    .filter((m) => {
      const p = posRangeOf(sheet.layout, m);
      return p && p.r1 <= range.r2 && range.r1 <= p.r2 && p.c1 <= range.c2 && range.c1 <= p.c2;
    })
    .map((m) => ({ k: 'unmerge' as const, range: m }));
  return changes.length ? { kind: 'layout', changes } : null;
}

// The fill handle: `target` is the source grown in one direction; the new cells continue or copy the source line
// by line. `copy` is Ctrl/⌥ held; `exact` copies with no series at all (Ctrl+D, Ctrl+R). Dragging back into the
// source clears what it leaves (`target` inside source).
export function fillRange(
  wb: Workbook,
  sheetId: string,
  source: GridRange,
  target: GridRange,
  copy = false,
  exact = false,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const inside =
    target.r1 >= source.r1 &&
    target.r2 <= source.r2 &&
    target.c1 >= source.c1 &&
    target.c2 <= source.c2;
  if (inside) {
    const cleared: GridRange[] = [];
    if (target.r2 < source.r2) cleared.push({ ...source, r1: target.r2 + 1 });
    if (target.c2 < source.c2) cleared.push({ ...source, c1: target.c2 + 1 });
    return clearRanges(sheet, cleared, 'all');
  }
  const ctx = wb.ctxFor(sheetId);
  const down = target.r2 > source.r2;
  const up = target.r1 < source.r1;
  const right = target.c2 > source.c2;
  const vertical = down || up;
  const cells: CellChange[] = [];
  const lines = vertical ? source.c2 - source.c1 + 1 : source.r2 - source.r1 + 1;
  const len = vertical ? source.r2 - source.r1 + 1 : source.c2 - source.c1 + 1;
  const count = vertical
    ? down
      ? target.r2 - source.r2
      : source.r1 - target.r1
    : right
      ? target.c2 - source.c2
      : source.c1 - target.c1;
  const cellAt = (r: number, c: number) => {
    const ids = idsAt(sheet, r, c);
    return ids ? sheet.cells.get(cellKey(ids.r, ids.c)) : undefined;
  };
  for (let line = 0; line < lines; line++) {
    const srcPos = (k: number): CellPos =>
      vertical
        ? { r: source.r1 + k, c: source.c1 + line }
        : { r: source.r1 + line, c: source.c1 + k };
    // Filling up or left runs the source backwards.
    const order = Array.from({ length: len }, (_, k) =>
      up || (!vertical && !right) ? len - 1 - k : k,
    );
    const srcCells = order.map((k) => cellAt(srcPos(k).r, srcPos(k).c));
    const literal = srcCells.map((x) => (x?.input && !('f' in x.input) ? x.input : undefined));
    const allLiteral = srcCells.every((x) => !x?.input || !('f' in x.input));
    const dateLike = srcCells.every((x) => x?.format?.nf === 'date');
    const backward = up || (!vertical && !right);
    const series =
      allLiteral && !exact ? fillSeries(literal, count, copy, dateLike, backward) : null;
    for (let k = 0; k < count; k++) {
      const step = k + 1;
      const pos: CellPos = vertical
        ? { r: down ? source.r2 + step : source.r1 - step, c: source.c1 + line }
        : { r: source.r1 + line, c: right ? source.c2 + step : source.c1 - step };
      const ids = idsAt(sheet, pos.r, pos.c);
      if (!ids) continue;
      const fromK = order[k % len]!;
      const from = srcPos(fromK);
      const src = cellAt(from.r, from.c);
      let i: CellChange['i'] = series ? (series[k] ?? null) : (src?.input ?? null);
      if (src?.input && 'f' in src.input)
        i = { f: shiftForCopy(src.input.f, pos.r - from.r, pos.c - from.c, ctx) };
      cells.push({ ...ids, i, f: (src?.format ?? null) as FormatPatch | null });
    }
  }
  return { kind: 'cells', cells };
}

// Ctrl+D / Ctrl+R: the first row (column) of the selection copied down (right) over the rest.
export function fillFromEdge(
  wb: Workbook,
  sheetId: string,
  range: GridRange,
  dir: 'down' | 'right',
): SheetWrite | null {
  if (dir === 'down') {
    const source = { ...range, r2: range.r1 };
    return range.r2 > range.r1 ? fillRange(wb, sheetId, source, range, false, true) : null;
  }
  const source = { ...range, c2: range.c1 };
  return range.c2 > range.c1 ? fillRange(wb, sheetId, source, range, false, true) : null;
}

// One write split into parts the api takes (SHEET_WRITE_CELLS_MAX cells, SHEET_WRITE_BYTES_MAX bytes each); the
// layout changes ride the first, so later parts land on the rows it made.
export function splitWrite(write: SheetWrite): SheetWrite[] {
  if (write.kind === 'title') return [write];
  const cells = write.cells ?? [];
  const parts: CellChange[][] = [];
  let cur: CellChange[] = [];
  let bytes = 0;
  for (const ch of cells) {
    const size = JSON.stringify(ch).length + 1;
    if (
      cur.length > 0 &&
      (cur.length >= SHEET_WRITE_CELLS_MAX || bytes + size > SHEET_WRITE_BYTES_MAX - 4096)
    ) {
      parts.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(ch);
    bytes += size;
  }
  if (cur.length) parts.push(cur);
  if (write.kind === 'cells')
    return parts.length ? parts.map((p) => ({ kind: 'cells', cells: p })) : [write];
  if (parts.length <= 1) return [write];
  return [
    { kind: 'layout', changes: write.changes, cells: parts[0]! },
    ...parts.slice(1).map((p): SheetWrite => ({ kind: 'cells', cells: p })),
  ];
}
