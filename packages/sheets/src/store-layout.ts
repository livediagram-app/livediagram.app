// Layout changes (docs/specs/029-sheets/sheet-store.md "Changing a sheet", blueprint "Writes"): inserting, deleting,
// moving, ordering, sizing, hiding, freezing, merging and filtering rows and columns, by id. Applying a change
// never needs a position someone else may have moved: ids that are gone are skipped, an `after` that is gone lands
// at the end.
import { insertIds, layoutIndex, moveIds } from './layout';
import type { CardTable, IdRange, SheetFilter, SheetLayout, FilterCondition } from './sheet';
import { sameName } from './range-names';

export type Axis = 'r' | 'c';

export type LayoutChange =
  | { k: 'insertRows' | 'insertCols'; after: string | null; ids: string[] }
  | { k: 'deleteRows' | 'deleteCols'; ids: string[] }
  | { k: 'moveRows' | 'moveCols'; ids: string[]; after: string | null }
  | { k: 'orderRows' | 'orderCols'; ids: string[] }
  | { k: 'size'; axis: Axis; ids: string[]; px: number | null }
  | { k: 'hide'; axis: Axis; ids: string[]; hidden: boolean }
  | { k: 'freeze'; rows?: number; cols?: number }
  | { k: 'merge'; range: IdRange }
  | { k: 'unmerge'; range: IdRange }
  // Every merge at once (undo of a deletion that shrank some).
  | { k: 'merges'; merges: IdRange[] }
  | { k: 'filter'; filter: SheetFilter | null }
  | { k: 'filterCond'; col: string; cond: FilterCondition | null }
  // The sheet's look (Sheet Settings): each key given is set; a size of null goes back to the default.
  | {
      k: 'options';
      showGrid?: boolean;
      showHeaders?: boolean;
      colWidth?: number | null;
      rowHeight?: number | null;
      setupPending?: boolean;
    }
  // A card table set (whole) or removed (null), by id.
  | { k: 'cardTable'; id: string; table: CardTable | null }
  // A named range set (its cells) or removed (null), by name (case aside).
  | { k: 'name'; name: string; range: IdRange | null };

function sameRange(a: IdRange, b: IdRange): boolean {
  return a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
}

// Reorder the ids `order` names into the slots they hold now, leaving every other id in place (so a row someone
// inserted while a sort was in flight keeps its place).
export function reorderSlots(list: readonly string[], order: readonly string[]): string[] {
  const named = new Set(order);
  const present = order.filter((id) => list.includes(id));
  const out = [...list];
  let k = 0;
  for (let i = 0; i < out.length; i++) if (named.has(out[i]!)) out[i] = present[k++]!;
  return out;
}

// A range whose corner ids were deleted shrinks to what is left of it (in the old layout's order), or goes when
// nothing is left.
export function shrinkRange(
  range: IdRange,
  before: SheetLayout,
  goneRows: ReadonlySet<string>,
  goneCols: ReadonlySet<string>,
): IdRange | null {
  const pick = (list: readonly string[], a: string, b: string, gone: ReadonlySet<string>) => {
    const ia = list.indexOf(a);
    const ib = list.indexOf(b);
    if (ia < 0 || ib < 0) return null;
    const [lo, hi] = ia <= ib ? [ia, ib] : [ib, ia];
    let first: string | null = null;
    let last: string | null = null;
    for (let i = lo; i <= hi; i++) {
      const id = list[i]!;
      if (gone.has(id)) continue;
      if (first === null) first = id;
      last = id;
    }
    return first === null ? null : ([first, last!] as const);
  };
  const rows = pick(before.rows, range.r1, range.r2, goneRows);
  const cols = pick(before.cols, range.c1, range.c2, goneCols);
  if (!rows || !cols) return null;
  return { r1: rows[0], r2: rows[1], c1: cols[0], c2: cols[1] };
}

function dropKeys(map: Record<string, number> | undefined, gone: ReadonlySet<string>) {
  if (!map) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) if (!gone.has(k)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

function withList<T>(value: T[] | undefined): T[] | undefined {
  return value && value.length > 0 ? value : undefined;
}

function frozenAfterDelete(
  frozen: number | undefined,
  list: readonly string[],
  gone: ReadonlySet<string>,
) {
  if (!frozen) return frozen;
  let lost = 0;
  for (let i = 0; i < Math.min(frozen, list.length); i++) if (gone.has(list[i]!)) lost++;
  return frozen - lost || undefined;
}

// The layout after one change. Pure; returns the same object when nothing changes.
export function applyLayoutChange(layout: SheetLayout, ch: LayoutChange): SheetLayout {
  switch (ch.k) {
    case 'insertRows':
    case 'insertCols': {
      const key = ch.k === 'insertRows' ? 'rows' : 'cols';
      const taken = new Set(layout[key]);
      const ids = ch.ids.filter((id) => !taken.has(id));
      if (ids.length === 0) return layout;
      return { ...layout, [key]: insertIds(layout[key], ch.after, ids) };
    }
    case 'deleteRows':
    case 'deleteCols': {
      const rows = ch.k === 'deleteRows';
      const list = rows ? layout.rows : layout.cols;
      const gone = new Set(ch.ids.filter((id) => list.includes(id)));
      if (gone.size === 0) return layout;
      const none = new Set<string>();
      const goneRows = rows ? gone : none;
      const goneCols = rows ? none : gone;
      const next: SheetLayout = {
        ...layout,
        rows: rows ? layout.rows.filter((id) => !gone.has(id)) : layout.rows,
        cols: rows ? layout.cols : layout.cols.filter((id) => !gone.has(id)),
      };
      const sizeKey = rows ? 'rowSize' : 'colSize';
      const hiddenKey = rows ? 'hiddenRows' : 'hiddenCols';
      next[sizeKey] = dropKeys(layout[sizeKey], gone);
      next[hiddenKey] = withList(layout[hiddenKey]?.filter((id) => !gone.has(id)));
      if (rows) next.frozenRows = frozenAfterDelete(layout.frozenRows, layout.rows, gone);
      else next.frozenCols = frozenAfterDelete(layout.frozenCols, layout.cols, gone);
      next.merges = withList(
        (layout.merges ?? [])
          .map((m) => shrinkRange(m, layout, goneRows, goneCols))
          .filter((m): m is IdRange => m !== null && !(m.r1 === m.r2 && m.c1 === m.c2)),
      );
      if (layout.filter) {
        const range = shrinkRange(layout.filter, layout, goneRows, goneCols);
        if (!range) next.filter = undefined;
        else {
          const conds = { ...layout.filter.conds };
          for (const id of goneCols) delete conds[id];
          next.filter = { ...range, conds };
        }
      }
      // Named ranges shrink as merges do; one whose cells all went loses its name.
      if (layout.names?.length) {
        const names = layout.names.flatMap((x) => {
          const range = shrinkRange(x, layout, goneRows, goneCols);
          return range ? [{ name: x.name, ...range }] : [];
        });
        next.names = names.length ? names : undefined;
      }
      // Card tables lose the deleted rows' links and drafts; a table whose header row or every column went is gone,
      // and a deleted Controls column is dropped (the next one is found again).
      if (layout.cardTables?.length) {
        const tables = layout.cardTables.flatMap((t): CardTable[] => {
          if (goneRows.has(t.head)) return [];
          const cols = t.cols.filter((col) => !goneCols.has(col.c));
          if (!cols.length) return [];
          const rowsLeft = Object.fromEntries(
            Object.entries(t.rows).filter(([r]) => !goneRows.has(r)),
          );
          const drafts = t.drafts?.filter((r) => !goneRows.has(r));
          const { drafts: _d, controls, ...rest } = t;
          return [
            {
              ...rest,
              cols,
              rows: rowsLeft,
              ...(drafts?.length ? { drafts } : {}),
              ...(controls && !goneCols.has(controls) ? { controls } : {}),
            },
          ];
        });
        next.cardTables = tables.length ? tables : undefined;
      }
      return clean(next);
    }
    case 'moveRows':
      return { ...layout, rows: moveIds(layout.rows, ch.ids, ch.after) };
    case 'moveCols':
      return { ...layout, cols: moveIds(layout.cols, ch.ids, ch.after) };
    case 'orderRows':
      return { ...layout, rows: reorderSlots(layout.rows, ch.ids) };
    case 'orderCols':
      return { ...layout, cols: reorderSlots(layout.cols, ch.ids) };
    case 'size': {
      const key = ch.axis === 'r' ? 'rowSize' : 'colSize';
      const live = new Set(ch.axis === 'r' ? layout.rows : layout.cols);
      const map = { ...(layout[key] ?? {}) };
      for (const id of ch.ids) {
        if (!live.has(id)) continue;
        if (ch.px === null) delete map[id];
        else map[id] = ch.px;
      }
      return clean({ ...layout, [key]: Object.keys(map).length ? map : undefined });
    }
    case 'hide': {
      const key = ch.axis === 'r' ? 'hiddenRows' : 'hiddenCols';
      const live = new Set(ch.axis === 'r' ? layout.rows : layout.cols);
      const set = new Set(layout[key] ?? []);
      for (const id of ch.ids) {
        if (!live.has(id)) continue;
        if (ch.hidden) set.add(id);
        else set.delete(id);
      }
      // Sorted by id, not by place, so moving rows never changes the list.
      const list = [...set].filter((id) => live.has(id)).sort();
      return clean({ ...layout, [key]: withList(list) });
    }
    case 'name': {
      const rest = (layout.names ?? []).filter((x) => !sameName(x.name, ch.name));
      const next = ch.range ? [...rest, { name: ch.name.trim(), ...ch.range }] : rest;
      return clean({ ...layout, names: next.length ? next : undefined });
    }
    case 'cardTable': {
      const rest = (layout.cardTables ?? []).filter((t) => t.id !== ch.id);
      const next = ch.table ? [...rest, ch.table] : rest;
      return clean({ ...layout, cardTables: next.length ? next : undefined });
    }
    case 'options':
      return clean({
        ...layout,
        ...(ch.showGrid !== undefined ? { showGrid: ch.showGrid ? undefined : false } : {}),
        ...(ch.showHeaders !== undefined
          ? { showHeaders: ch.showHeaders ? undefined : false }
          : {}),
        ...(ch.colWidth !== undefined ? { colWidth: ch.colWidth ?? undefined } : {}),
        ...(ch.rowHeight !== undefined ? { rowHeight: ch.rowHeight ?? undefined } : {}),
        ...(ch.setupPending !== undefined ? { setupPending: ch.setupPending || undefined } : {}),
      });
    case 'freeze':
      return clean({
        ...layout,
        ...(ch.rows !== undefined ? { frozenRows: ch.rows || undefined } : {}),
        ...(ch.cols !== undefined ? { frozenCols: ch.cols || undefined } : {}),
      });
    case 'merge': {
      const ix = layoutIndex(layout);
      const r = ch.range;
      if (
        ![r.r1, r.r2].every((id) => ix.rowPos.has(id)) ||
        ![r.c1, r.c2].every((id) => ix.colPos.has(id))
      )
        return layout;
      const merges = (layout.merges ?? []).filter((m) => !sameRange(m, r));
      return { ...layout, merges: [...merges, r] };
    }
    case 'unmerge': {
      const merges = (layout.merges ?? []).filter((m) => !sameRange(m, ch.range));
      return clean({ ...layout, merges: withList(merges) });
    }
    case 'merges': {
      const ix = layoutIndex(layout);
      const live = ch.merges.filter(
        (m) =>
          ix.rowPos.has(m.r1) && ix.rowPos.has(m.r2) && ix.colPos.has(m.c1) && ix.colPos.has(m.c2),
      );
      return clean({ ...layout, merges: withList(live) });
    }
    case 'filter':
      return clean({ ...layout, filter: ch.filter ?? undefined });
    case 'filterCond': {
      if (!layout.filter) return layout;
      const conds = { ...layout.filter.conds };
      if (ch.cond === null) delete conds[ch.col];
      else conds[ch.col] = ch.cond;
      return { ...layout, filter: { ...layout.filter, conds } };
    }
  }
}

// Drop keys left undefined, so a layout round-trips through JSON unchanged.
function clean(layout: SheetLayout): SheetLayout {
  const out = { ...layout } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as SheetLayout;
}
