'use client';

// Everything a Sheet's keys, toolbar and menus do (docs/specs/029-sheets/sheet.md "Editing", "Keyboard",
// "Formatting", "Rows and columns", "Sort", "Filter", "Freeze"), built from the engine's command builders and sent
// through the controller's write. One place, so a toolbar button and its shortcut can never differ.
import { chartRangeOf, NOTHING_TO_CHART, type SheetChartKind } from './sheet-charts';
import { useMemo } from 'react';
import {
  PARSE_FAILURE_COPY,
  appendAxis,
  borderRange,
  callsOf,
  clearRanges,
  resetSheetWrite,
  colWidth,
  deleteAxis,
  extendSelection,
  fillFromEdge,
  fillRange,
  formatA1,
  formatRanges,
  freeze,
  hideAxis,
  inputAsText,
  insertAxis,
  mergeRange,
  moveAxis,
  moveSelection,
  parseFormula,
  resizeAxis,
  rowHeight,
  serialFromMs,
  setFilterCondition,
  single,
  sortRange,
  sortSheet,
  stepDecimals,
  toggleFilter,
  typeInto,
  typeIntoRanges,
  unmergeRange,
  cellKey,
  type Border,
  type BorderMode,
  type CellFormat,
  type Dir,
  type FilterCondition,
  type FormatPatch,
  type GridRange,
  type NumberFormatKind,
  type SortKey,
  shiftCells,
  type ShiftMode,
  SHEET_FREEZE_COLS_MAX,
  SHEET_FREEZE_ROWS_MAX,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import { useSheetController, type SheetController } from './sheet-controller';
import { fontPx, roughWidth } from './SheetCells';

export type EditResult = { ok: true } | { ok: false; message: string; at: number };

function primary(c: SheetController): GridRange {
  const ranges = c.selectionNow().ranges;
  return ranges[ranges.length - 1]!;
}

function activeFormat(c: SheetController): CellFormat | undefined {
  const { r, c: col } = c.selectionNow().active;
  const rowId = c.sheet.layout.rows[r];
  const colId = c.sheet.layout.cols[col];
  return rowId && colId ? c.sheet.cells.get(cellKey(rowId, colId))?.format : undefined;
}

// The text an edit of the active cell starts from (Enter, F2, a double-click): the input as typed.
export function inputTextAt(c: SheetController, r: number, col: number): string {
  const rowId = c.sheet.layout.rows[r];
  const colId = c.sheet.layout.cols[col];
  const input = rowId && colId ? c.sheet.cells.get(cellKey(rowId, colId))?.input : undefined;
  return inputAsText(input, c.workbook.ctxFor(c.sheet.id));
}

function firstUse(text: string): void {
  if (!text.startsWith('=')) return;
  const parsed = parseFormula(text);
  if (!parsed.ok) return;
  for (const name of callsOf(parsed.ast)) track('Sheet', 'Used', name);
}

export function useSheetActions() {
  const c = useSheetController();
  return useMemo(() => {
    const sel = () => c.selectionNow();
    const ranges = () => c.selectionNow().ranges;
    const fmt = (patch: FormatPatch) => {
      const w = formatRanges(c.workbook, c.sheet.id, ranges(), patch);
      if (w) c.write(w, 'Format');
    };
    const go = (s: typeof c.selection) => {
      c.setTabRun(null);
      c.setSelection(s);
    };
    const announceCell = (r: number, col: number) => c.announce(formatA1(r, col));
    return {
      // ---- Editing ----
      startEdit(origin: 'type' | 'cell' | 'bar', text?: string) {
        if (!c.canEdit) return;
        const { r, c: col } = sel().active;
        c.setEditing({ r, c: col, origin, draft: text ?? inputTextAt(c, r, col) });
      },
      cancelEdit() {
        c.setEditing(null);
        c.focusGrid();
      },
      // Save the draft, then move (Enter down, Tab right, ...). `all` is Ctrl+Enter: into every selected cell.
      commitEdit(move: Dir | 'none', all = false): EditResult {
        const e = c.editing;
        if (!e) return { ok: true };
        const result = all
          ? typeIntoRanges(c.workbook, c.sheet.id, { r: e.r, c: e.c }, ranges(), e.draft)
          : typeInto(c.workbook, c.sheet.id, { r: e.r, c: e.c }, e.draft);
        if (result && !result.ok) {
          const reason = result.read.reason;
          return {
            ok: false,
            message:
              reason === 'input_too_long'
                ? 'A cell holds up to 10,000 characters'
                : PARSE_FAILURE_COPY[reason],
            at: result.read.at,
          };
        }
        if (result?.ok) {
          // An edit ends the copied range's marquee, as in Sheets and Excel (what the clipboard holds stays).
          c.setMarquee(null);
          const formula = e.draft.startsWith('=');
          if (c.write(result.write, formula ? 'Formula' : 'Cell')) firstUse(e.draft);
        }
        c.setEditing(null);
        if (move !== 'none' && !all) {
          const started = c.tabRun();
          const run = started && started.r === e.r ? started : null;
          // Enter after a run of Tabs: the next row, in the column the run began in.
          const from = move === 'down' && run ? { r: e.r, c: run.c } : { r: e.r, c: e.c };
          go(moveSelection(single(from), move, c.grid));
          if (move === 'right') c.setTabRun(run ?? { r: e.r, c: e.c });
        }
        c.focusGrid();
        return { ok: true };
      },
      // ---- Moving ----
      move(dir: Dir, jump = false, extend = false) {
        const next = extend
          ? extendSelection(sel(), dir, c.grid, jump)
          : moveSelection(sel(), dir, c.grid, jump);
        go(next);
        announceCell(next.active.r, next.active.c);
      },
      goTo(range: GridRange) {
        go({
          ranges: [range],
          active: { r: range.r1, c: range.c1 },
          anchor: { r: range.r1, c: range.c1 },
        });
      },
      // ---- Clearing and formats ----
      clear(what: 'inputs' | 'formats' | 'all') {
        const w = clearRanges(c.sheet, ranges(), what);
        // Clear Formatting with nothing to clear says so, rather than meet the press with silence (Delete on an
        // empty cell stays quiet).
        if (w.kind === 'cells' && w.cells.length === 0) {
          if (what === 'formats') c.notify('No formatting to clear here');
          return;
        }
        c.write(w, what === 'formats' ? 'Format' : 'Clear');
      },
      format: fmt,
      toggle(flag: 'b' | 'i' | 'u' | 'st') {
        fmt({ [flag]: activeFormat(c)?.[flag] ? null : true });
      },
      numberFormat(nf: NumberFormatKind, cur?: string) {
        fmt({ nf: nf === 'auto' ? null : nf, dp: null, ...(cur ? { cur } : {}) });
      },
      decimals(delta: 1 | -1) {
        const f = activeFormat(c);
        const v = c.workbook.value(c.sheet.id, sel().active.r, sel().active.c);
        fmt({
          dp: stepDecimals(
            f?.dp,
            !f?.nf || f.nf === 'auto',
            typeof v === 'number' ? v : null,
            delta,
          ),
        });
      },
      borders(mode: BorderMode, border: Border) {
        const w = borderRange(c.workbook, c.sheet.id, primary(c), mode, border);
        if (w) c.write(w, 'Format');
      },
      // Merge: asks first (through `confirm`) when it would clear inputs.
      merge(mode: 'all' | 'across', confirm: () => boolean) {
        const m = mergeRange(c.sheet, primary(c), mode);
        if (!m) return;
        if (m.needsConfirm && !confirm()) return;
        c.write(m.write, 'Merge');
      },
      unmerge() {
        const w = unmergeRange(c.sheet, primary(c));
        if (w) c.write(w, 'Merge');
      },
      activeFormat: () => activeFormat(c),
      // ---- Fill ----
      fill(source: GridRange, target: GridRange, copy: boolean) {
        const w = fillRange(c.workbook, c.sheet.id, source, target, copy);
        if (w) c.write(w, 'Fill');
      },
      fillEdge(dir: 'down' | 'right') {
        const w = fillFromEdge(c.workbook, c.sheet.id, primary(c), dir);
        if (w) c.write(w, 'Fill');
      },
      // ---- Rows and columns ----
      insert(axis: 'r' | 'c', side: 'before' | 'after') {
        const g = primary(c);
        const [a, b] = axis === 'r' ? [g.r1, g.r2] : [g.c1, g.c2];
        const w = insertAxis(c.sheet, axis, side === 'before' ? a : b, b - a + 1, side);
        if (w) c.write(w, axis === 'r' ? 'Rows' : 'Columns');
        c.announce(`${b - a + 1} ${axis === 'r' ? 'row' : 'column'}${b > a ? 's' : ''} inserted`);
      },
      // Insert Cells / Delete Cells: the cells beside the selection move to make room or close the gap.
      shift(mode: ShiftMode) {
        const res = shiftCells(c.workbook, c.sheet.id, primary(c), mode);
        if (res) c.writeAll(res.edits, 'Shift');
      },
      appendRows(count: number) {
        const w = appendAxis(c.sheet, 'r', count);
        if (w) c.write(w, 'Rows');
      },
      remove(axis: 'r' | 'c') {
        const g = primary(c);
        const w =
          axis === 'r'
            ? deleteAxis(c.sheet, 'r', g.r1, g.r2)
            : deleteAxis(c.sheet, 'c', g.c1, g.c2);
        if (!w || !c.write(w, axis === 'r' ? 'Rows' : 'Columns')) return;
        // The cell where the first deleted line was, or the new last line when the deleted ones were last.
        const rows = c.sheet.layout.rows.length - (axis === 'r' ? g.r2 - g.r1 + 1 : 0);
        const cols = c.sheet.layout.cols.length - (axis === 'c' ? g.c2 - g.c1 + 1 : 0);
        go(
          single({
            r: Math.max(0, Math.min(g.r1, rows - 1)),
            c: Math.max(0, Math.min(g.c1, cols - 1)),
          }),
        );
      },
      hide(axis: 'r' | 'c', hidden: boolean, from?: number, to?: number) {
        const g = primary(c);
        const [a, b] =
          from !== undefined ? [from, to ?? from] : axis === 'r' ? [g.r1, g.r2] : [g.c1, g.c2];
        const w = hideAxis(c.sheet, axis, a, b, hidden);
        if (w) c.write(w, axis === 'r' ? 'Rows' : 'Columns');
      },
      resize(axis: 'r' | 'c', positions: number[], px: number | null) {
        const w = resizeAxis(c.sheet, axis, positions, px);
        if (w) c.write(w, axis === 'r' ? 'Rows' : 'Columns');
      },
      // Double-click a header edge: the widest (tallest) value of the lines, measured roughly from their text.
      autofit(axis: 'r' | 'c', positions: number[]) {
        const ext = c.workbook.extent(c.sheet.id);
        for (const p of positions) {
          let best = axis === 'c' ? 24 : 18;
          const n = axis === 'c' ? ext.rows : ext.cols;
          for (let k = 0; k < n; k++) {
            const [r, col] = axis === 'c' ? [k, p] : [p, k];
            const rowId = c.sheet.layout.rows[r]!;
            const colId = c.sheet.layout.cols[col]!;
            const f = c.sheet.cells.get(cellKey(rowId, colId))?.format;
            const v = c.workbook.value(c.sheet.id, r, col);
            if (v === null) continue;
            const px = fontPx(f);
            const text = typeof v === 'object' ? '#VALUE!' : String(v);
            best = Math.max(
              best,
              axis === 'c' ? roughWidth(text, px) + 14 : Math.round(px * 1.3) + 8,
            );
          }
          const w = resizeAxis(c.sheet, axis, [p], Math.min(2000, Math.ceil(best)));
          if (w) c.write(w, axis === 'r' ? 'Rows' : 'Columns');
        }
      },
      // Dragged headers: lines from..to moved to before position `before`.
      moveAxis(axis: 'r' | 'c', from: number, to: number, before: number) {
        const w = moveAxis(c.sheet, axis, from, to, before);
        if (w) c.write(w, axis === 'r' ? 'Rows' : 'Columns');
      },
      sizeOf(axis: 'r' | 'c', p: number) {
        return axis === 'r'
          ? rowHeight(c.sheet.layout, c.sheet.layout.rows[p]!)
          : colWidth(c.sheet.layout, c.sheet.layout.cols[p]!);
      },
      // ---- Sort, filter, freeze ----
      sortColumn(ascending: boolean) {
        const w = sortSheet(c.workbook, c.sheet.id, sel().active.c, ascending);
        if (w) {
          c.write(w, 'Sort');
          c.announce(ascending ? 'Sorted A to Z' : 'Sorted Z to A');
        }
      },
      sortRange(keys: SortKey[], header: boolean) {
        const w = sortRange(c.workbook, c.sheet.id, primary(c), keys, header);
        if (w) c.write(w, 'Sort');
      },
      toggleFilter() {
        const w = toggleFilter(c.workbook, c.sheet.id, primary(c), c.grid);
        if (w) c.write(w, 'Filter');
      },
      setFilter(colId: string, cond: FilterCondition | null) {
        c.write(setFilterCondition(colId, cond), 'Filter');
      },
      // Insert Chart: the selection (or the data around the cell) as a chart over the Sheet.
      insertChart(kind: SheetChartKind) {
        const pick = chartRangeOf(c.workbook, c.sheet, c.selectionNow());
        if (!pick) return c.toast(NOTHING_TO_CHART);
        c.placeChart?.(kind, pick);
      },
      // Clear Sheet: the sheet back to how a placed one starts (Setup Sheet shows again), one change and one undo.
      clearSheet() {
        c.write(resetSheetWrite(c.sheet), 'Clear');
      },
      // The sheet's look (Sheet Settings): gridlines, headers, default sizes (null back to the default).
      setOptions(options: {
        showGrid?: boolean;
        showHeaders?: boolean;
        colWidth?: number | null;
        rowHeight?: number | null;
      }) {
        c.write({ kind: 'layout', changes: [{ k: 'options', ...options }] }, 'Settings');
      },
      // Clamped to the freeze limits, so Up to Row 300 freezes what it may rather than being refused.
      freeze(rows?: number, cols?: number) {
        const most = (n: number | undefined, max: number, lines: number) =>
          n === undefined ? n : Math.min(n, max, lines - 1);
        c.write(
          freeze(
            most(rows, SHEET_FREEZE_ROWS_MAX, c.sheet.layout.rows.length),
            most(cols, SHEET_FREEZE_COLS_MAX, c.sheet.layout.cols.length),
          ),
          'Freeze',
        );
      },
      // ---- Dates ----
      typeNow(what: 'date' | 'time') {
        const now = new Date();
        const serial = serialFromMs(now.getTime() - now.getTimezoneOffset() * 60_000);
        const { r, c: col } = sel().active;
        const rowId = c.sheet.layout.rows[r]!;
        const colId = c.sheet.layout.cols[col]!;
        const n = what === 'date' ? Math.floor(serial) : serial - Math.floor(serial);
        c.write(
          { kind: 'cells', cells: [{ r: rowId, c: colId, i: { n }, f: { nf: what } }] },
          'Cell',
        );
      },
    };
  }, [c]);
}

export type SheetActions = ReturnType<typeof useSheetActions>;
