// Sheet writes (docs/specs/029-sheets/sheet-store.md "Changing a sheet"; blueprint sheets-engine.md "Writes"). One
// pure apply, used by the api, the offline store and the editor's optimistic apply, so all converge; and its
// inverse, for undo. A write lands on ids: what it names that is gone is skipped, never moved somewhere else.
import { FORMAT_KEYS, mergeFormat, type FormatPatch } from './format';
import { layoutIndex } from './layout';
import { mapFormulaRefs } from './formula/stored';
import { applyLayoutChange, shrinkRange, type LayoutChange } from './store-layout';
import { sameName } from './range-names';
import {
  cellKey,
  splitCellKey,
  type Cell,
  type CellFormat,
  type CellInput,
  type IdRange,
  type Sheet,
  type SheetLayout,
  type SheetPerson,
  type StoredRef,
} from './sheet';

export type { LayoutChange } from './store-layout';

// One cell's change: `i` absent keeps the input, null clears it; `f` absent keeps the format, null clears it all,
// an object sets (or, with null values, clears) its keys.
export type CellChange = { r: string; c: string; i?: CellInput | null; f?: FormatPatch | null };

export type SheetWrite =
  | { kind: 'cells'; cells: CellChange[] }
  | { kind: 'layout'; changes: LayoutChange[]; cells?: CellChange[] }
  | { kind: 'title'; title: string };

export type ApplyContext = { now: number; by: SheetPerson };

export type Applied = {
  sheet: Sheet;
  // The write as it landed: gone ids dropped, and the formula rewrites a deletion made, which every client then
  // applies as they are.
  applied: SheetWrite;
  // Cell keys whose cell changed, for recalculation and for the answer's stored cells.
  touched: string[];
};

function applyCells(
  cells: Map<string, Cell>,
  layout: SheetLayout,
  changes: readonly CellChange[],
  touched: Set<string>,
): CellChange[] {
  const ix = layoutIndex(layout);
  const landed: CellChange[] = [];
  for (const ch of changes) {
    if (!ix.rowPos.has(ch.r) || !ix.colPos.has(ch.c)) continue;
    const key = cellKey(ch.r, ch.c);
    const before = cells.get(key);
    const input = ch.i === undefined ? before?.input : (ch.i ?? undefined);
    const format = ch.f === undefined ? before?.format : mergeFormat(before?.format, ch.f);
    if (input === undefined && format === undefined) cells.delete(key);
    else cells.set(key, { ...(input ? { input } : {}), ...(format ? { format } : {}) });
    touched.add(key);
    landed.push(ch);
  }
  return landed;
}

// Deleting rows or columns shrinks the ranges of this sheet's own formulas whose corners were in them, so
// `SUM(A1:A10)` with row 1 deleted reads A1:A9 rather than #REF! (sheet-store.md "Rows and columns by id").
function shrinkFormulas(
  cells: Map<string, Cell>,
  before: SheetLayout,
  goneRows: ReadonlySet<string>,
  goneCols: ReadonlySet<string>,
): CellChange[] {
  const out: CellChange[] = [];
  for (const [key, cell] of cells) {
    const input = cell.input;
    if (!input || !('f' in input)) continue;
    const next = mapFormulaRefs(input.f, (ref) => shrinkRef(ref, before, goneRows, goneCols));
    if (next === input.f) continue;
    const { r, c } = splitCellKey(key);
    out.push({ r, c, i: { f: next } });
  }
  return out;
}

function shrinkRef(
  ref: StoredRef,
  before: SheetLayout,
  goneRows: ReadonlySet<string>,
  goneCols: ReadonlySet<string>,
): StoredRef {
  if (ref.s !== undefined || ref.st !== undefined) return ref;
  const isRange = ref.r2 !== undefined || ref.c2 !== undefined;
  if (!isRange) return ref;
  const cornerGone =
    (ref.r1 !== undefined && goneRows.has(ref.r1)) ||
    (ref.r2 !== undefined && goneRows.has(ref.r2)) ||
    (ref.c1 !== undefined && goneCols.has(ref.c1)) ||
    (ref.c2 !== undefined && goneCols.has(ref.c2));
  if (!cornerGone) return ref;
  // A whole-column or whole-row side has no corner of its own: borrow the grid's edge for the shrink.
  const full = {
    r1: ref.r1 ?? before.rows[0]!,
    r2: ref.r2 ?? ref.r1 ?? before.rows[before.rows.length - 1]!,
    c1: ref.c1 ?? before.cols[0]!,
    c2: ref.c2 ?? ref.c1 ?? before.cols[before.cols.length - 1]!,
  };
  const shrunk = shrinkRange(full, before, goneRows, goneCols);
  if (!shrunk) return ref;
  const out: StoredRef = { ...ref };
  if (ref.r1 !== undefined) out.r1 = shrunk.r1;
  if (ref.r2 !== undefined) out.r2 = shrunk.r2;
  if (ref.c1 !== undefined) out.c1 = shrunk.c1;
  if (ref.c2 !== undefined) out.c2 = shrunk.c2;
  return out;
}

const idRangeOf = (x: IdRange): IdRange => ({ r1: x.r1, c1: x.c1, r2: x.r2, c2: x.c2 });

export function applySheetWrite(sheet: Sheet, write: SheetWrite, ctx: ApplyContext): Applied {
  const touched = new Set<string>();
  const stamp = { updatedAt: ctx.now, updatedBy: ctx.by };
  if (write.kind === 'title') {
    return {
      sheet: { ...sheet, title: write.title, rev: sheet.rev + 1, ...stamp },
      applied: write,
      touched: [],
    };
  }
  const cells = new Map(sheet.cells);
  if (write.kind === 'cells') {
    const landed = applyCells(cells, sheet.layout, write.cells, touched);
    return {
      sheet: { ...sheet, cells, rev: sheet.rev + 1, ...stamp },
      applied: { kind: 'cells', cells: landed },
      touched: [...touched],
    };
  }
  let layout = sheet.layout;
  const derived: CellChange[] = [];
  for (const ch of write.changes) {
    const before = layout;
    layout = applyLayoutChange(layout, ch);
    if ((ch.k === 'deleteRows' || ch.k === 'deleteCols') && layout !== before) {
      const rows = ch.k === 'deleteRows';
      const had = new Set(rows ? before.rows : before.cols);
      const gone = new Set(ch.ids.filter((id) => had.has(id)));
      const none = new Set<string>();
      // Rewrite surviving formulas first, against the layout they were written for.
      const rewrites = shrinkFormulas(cells, before, rows ? gone : none, rows ? none : gone);
      for (const [key] of cells) {
        const { r, c } = splitCellKey(key);
        if ((rows && gone.has(r)) || (!rows && gone.has(c))) {
          cells.delete(key);
          touched.add(key);
        }
      }
      for (const rw of rewrites) {
        if ((rows && gone.has(rw.r)) || (!rows && gone.has(rw.c))) continue;
        derived.push(rw);
      }
    }
  }
  const landedCells = applyCells(cells, layout, [...derived, ...(write.cells ?? [])], touched);
  const next: Sheet = { ...sheet, layout, cells, rev: sheet.rev + 1, ...stamp };
  return {
    sheet: next,
    applied: {
      kind: 'layout',
      changes: write.changes,
      ...(landedCells.length ? { cells: landedCells } : {}),
    },
    touched: [...touched],
  };
}

// The cell changes that put `keys` back as they are in `before`.
function restoreCells(before: Sheet, keys: Iterable<string>): CellChange[] {
  const out: CellChange[] = [];
  for (const key of keys) {
    const { r, c } = splitCellKey(key);
    const cell = before.cells.get(key);
    out.push({ r, c, i: cell?.input ?? null, f: formatRestore(cell?.format) });
  }
  return out;
}

// A full replacement: every key cleared, then the old ones set, so an undo also removes keys the change added.
function formatRestore(format: CellFormat | undefined): FormatPatch | null {
  if (!format) return null;
  const patch: FormatPatch = {};
  for (const k of FORMAT_KEYS) patch[k] = null;
  return { ...patch, ...(format as FormatPatch) };
}

// Contiguous runs of `ids` in `list`, each with the id before it (null at the start).
function runsOf(
  list: readonly string[],
  ids: ReadonlySet<string>,
): { after: string | null; ids: string[] }[] {
  const runs: { after: string | null; ids: string[] }[] = [];
  let lastKept: string | null = null;
  let cur: { after: string | null; ids: string[] } | null = null;
  for (const id of list) {
    if (ids.has(id)) {
      if (!cur) {
        cur = { after: lastKept, ids: [] };
        runs.push(cur);
      }
      cur.ids.push(id);
    } else {
      lastKept = id;
      cur = null;
    }
  }
  return runs;
}

// The ids not in `list`, in one pass over each (a Set, never a scan per id: a sheet has 10k rows).
function without(ids: readonly string[], list: readonly string[]): string[] {
  const has = new Set(list);
  return ids.filter((id) => !has.has(id));
}

function inverseLayout(before: SheetLayout, ch: LayoutChange): LayoutChange[] {
  switch (ch.k) {
    // Deleting a frozen row unfreezes it, so the undo of an insert also puts the freeze back.
    case 'insertRows':
      return [
        { k: 'deleteRows', ids: without(ch.ids, before.rows) },
        { k: 'freeze', rows: before.frozenRows ?? 0 },
      ];
    case 'insertCols':
      return [
        { k: 'deleteCols', ids: without(ch.ids, before.cols) },
        { k: 'freeze', cols: before.frozenCols ?? 0 },
      ];
    case 'deleteRows':
    case 'deleteCols': {
      const rows = ch.k === 'deleteRows';
      const list = rows ? before.rows : before.cols;
      const has = new Set(list);
      const gone = new Set(ch.ids.filter((id) => has.has(id)));
      const axis = rows ? 'r' : 'c';
      const out: LayoutChange[] = runsOf(list, gone).map((run) => ({
        k: rows ? 'insertRows' : 'insertCols',
        after: run.after,
        ids: run.ids,
      }));
      const sizes = rows ? before.rowSize : before.colSize;
      const bySize = new Map<number, string[]>();
      for (const id of gone) {
        const px = sizes?.[id];
        if (px !== undefined) bySize.set(px, [...(bySize.get(px) ?? []), id]);
      }
      for (const [px, ids] of bySize) out.push({ k: 'size', axis, ids, px });
      const hidden = (rows ? before.hiddenRows : before.hiddenCols)?.filter((id) => gone.has(id));
      if (hidden?.length) out.push({ k: 'hide', axis, ids: hidden, hidden: true });
      out.push(
        rows
          ? { k: 'freeze', rows: before.frozenRows ?? 0 }
          : { k: 'freeze', cols: before.frozenCols ?? 0 },
      );
      out.push({ k: 'merges', merges: before.merges ?? [] });
      out.push({ k: 'filter', filter: before.filter ?? null });
      // The card tables as they were, links and drafts of the deleted lines included; the named ranges too.
      for (const t of before.cardTables ?? []) out.push({ k: 'cardTable', id: t.id, table: t });
      for (const x of before.names ?? [])
        out.push({ k: 'name', name: x.name, range: idRangeOf(x) });
      return out;
    }
    case 'moveRows':
    case 'orderRows':
      return [{ k: 'orderRows', ids: [...before.rows] }];
    case 'moveCols':
    case 'orderCols':
      return [{ k: 'orderCols', ids: [...before.cols] }];
    case 'size': {
      const sizes = ch.axis === 'r' ? before.rowSize : before.colSize;
      const groups = new Map<number | null, string[]>();
      for (const id of ch.ids) {
        const px = sizes?.[id] ?? null;
        groups.set(px, [...(groups.get(px) ?? []), id]);
      }
      return [...groups].map(([px, ids]) => ({ k: 'size', axis: ch.axis, ids, px }));
    }
    case 'hide': {
      const hidden = new Set(ch.axis === 'r' ? before.hiddenRows : before.hiddenCols);
      const was = ch.ids.filter((id) => hidden.has(id));
      const wasnt = ch.ids.filter((id) => !hidden.has(id));
      return [
        ...(was.length ? [{ k: 'hide' as const, axis: ch.axis, ids: was, hidden: true }] : []),
        ...(wasnt.length ? [{ k: 'hide' as const, axis: ch.axis, ids: wasnt, hidden: false }] : []),
      ];
    }
    case 'name': {
      const was = before.names?.find((x) => sameName(x.name, ch.name));
      return [
        // Whatever this name was set to before (or none); a different spelling of it is put back too.
        ...(was && was.name !== ch.name
          ? [{ k: 'name' as const, name: ch.name, range: null }]
          : []),
        { k: 'name', name: was?.name ?? ch.name, range: was ? idRangeOf(was) : null },
      ];
    }
    case 'cardTable':
      return [
        {
          k: 'cardTable',
          id: ch.id,
          table: before.cardTables?.find((t) => t.id === ch.id) ?? null,
        },
      ];
    case 'options':
      return [
        {
          k: 'options',
          ...(ch.showGrid !== undefined ? { showGrid: before.showGrid !== false } : {}),
          ...(ch.showHeaders !== undefined ? { showHeaders: before.showHeaders !== false } : {}),
          ...(ch.colWidth !== undefined ? { colWidth: before.colWidth ?? null } : {}),
          ...(ch.rowHeight !== undefined ? { rowHeight: before.rowHeight ?? null } : {}),
          ...(ch.setupPending !== undefined ? { setupPending: before.setupPending === true } : {}),
        },
      ];
    case 'freeze':
      return [
        {
          k: 'freeze',
          ...(ch.rows !== undefined ? { rows: before.frozenRows ?? 0 } : {}),
          ...(ch.cols !== undefined ? { cols: before.frozenCols ?? 0 } : {}),
        },
      ];
    case 'merge': {
      const had = (before.merges ?? []).some(
        (m) =>
          m.r1 === ch.range.r1 &&
          m.c1 === ch.range.c1 &&
          m.r2 === ch.range.r2 &&
          m.c2 === ch.range.c2,
      );
      return had ? [] : [{ k: 'unmerge', range: ch.range }];
    }
    case 'unmerge': {
      const had = (before.merges ?? []).find(
        (m) =>
          m.r1 === ch.range.r1 &&
          m.c1 === ch.range.c1 &&
          m.r2 === ch.range.r2 &&
          m.c2 === ch.range.c2,
      );
      return had ? [{ k: 'merge', range: had }] : [];
    }
    case 'merges':
      return [{ k: 'merges', merges: before.merges ?? [] }];
    case 'filter':
      return [{ k: 'filter', filter: before.filter ?? null }];
    case 'filterCond':
      return before.filter
        ? [{ k: 'filterCond', col: ch.col, cond: before.filter.conds[ch.col] ?? null }]
        : [{ k: 'filter', filter: null }];
  }
}

// The write that undoes `result` (made from `before`): exactly the cells, rows and columns it touched go back.
export function inverseSheetWrite(before: Sheet, result: Applied): SheetWrite {
  const applied = result.applied;
  if (applied.kind === 'title') return { kind: 'title', title: before.title };
  const cells = restoreCells(before, result.touched);
  if (applied.kind === 'cells') return { kind: 'cells', cells };
  // Undo the layout changes last to first, each against the layout it was applied to.
  const layouts: SheetLayout[] = [before.layout];
  for (const ch of applied.changes)
    layouts.push(applyLayoutChange(layouts[layouts.length - 1]!, ch));
  const changes: LayoutChange[] = [];
  for (let i = applied.changes.length - 1; i >= 0; i--)
    changes.push(...inverseLayout(layouts[i]!, applied.changes[i]!));
  return { kind: 'layout', changes, ...(cells.length ? { cells } : {}) };
}

export type MergeOutcome =
  | { kind: 'applied'; sheet: Sheet; touched: string[] }
  | { kind: 'duplicate' }
  | { kind: 'refetch' };

// A write someone made, heard from the room at `rev`: applied in order, a repeat ignored, a gap refetched.
export function mergeSheetChange(
  local: Sheet,
  op: { rev: number; applied: SheetWrite; at: number; by: SheetPerson },
): MergeOutcome {
  if (op.rev <= local.rev) return { kind: 'duplicate' };
  if (op.rev !== local.rev + 1) return { kind: 'refetch' };
  const r = applySheetWrite(local, op.applied, { now: op.at, by: op.by });
  return { kind: 'applied', sheet: { ...r.sheet, rev: op.rev }, touched: r.touched };
}

// The pending local writes laid over the confirmed sheet, as the person sees it.
export function rebase(
  confirmed: Sheet,
  pending: readonly SheetWrite[],
  ctx: ApplyContext,
): Applied {
  let sheet = confirmed;
  const touched = new Set<string>();
  let last: SheetWrite = { kind: 'cells', cells: [] };
  for (const w of pending) {
    const r = applySheetWrite(sheet, w, ctx);
    sheet = { ...r.sheet, rev: confirmed.rev };
    for (const k of r.touched) touched.add(k);
    last = r.applied;
  }
  return { sheet, applied: last, touched: [...touched] };
}

// Every cell key a write names, for undo grouping and presence.
export function writeTouches(write: SheetWrite): string[] {
  if (write.kind === 'title') return [];
  return (write.cells ?? []).map((c) => cellKey(c.r, c.c));
}
