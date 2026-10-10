// The undo of deleting rows or columns (docs/specs/029-sheets/sheet-store.md "Undo"; blueprint sheets-engine.md
// "Writes"): the lines come back with their ids, places, sizes and hidden state, and of what the deletion shrank or
// dropped (merges, the filter, named ranges, card tables' links, drafts and columns) exactly that is put back, into
// the sheet as it is when the undo is made. Whatever else changed since (a row linked or drafted, a merge made, a
// name set) is left as it is, and a thing someone else changed after the deletion (a shrunk merge unmerged, a
// shrunk filter replaced) is theirs, so it is not put back over them.
import { applyLayoutChange, shrinkRange, type LayoutChange } from './store-layout';
import { sameName } from './range-names';
import type { CardTable, FilterCondition, IdRange, SheetLayout } from './sheet';

export const idRangeOf = (x: IdRange): IdRange => ({ r1: x.r1, c1: x.c1, r2: x.r2, c2: x.c2 });

const rangeKey = (m: IdRange) => `${m.r1}|${m.c1}|${m.r2}|${m.c2}`;

const sameRange = (a: IdRange, b: IdRange) => rangeKey(a) === rangeKey(b);

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

type Gone = { rows: ReadonlySet<string>; cols: ReadonlySet<string> };

const shrunk = (m: IdRange, before: SheetLayout, gone: Gone) =>
  shrinkRange(m, before, gone.rows, gone.cols);

// The merges the deletion shrank or dropped, each back as it was; the rest as they are now. In the old order when
// nothing else changed, so an undo straight after is exact.
function restoreMerges(before: SheetLayout, now: SheetLayout, gone: Gone): LayoutChange[] {
  const touched = (before.merges ?? []).filter((m) => {
    const s = shrunk(m, before, gone);
    return !s || !sameRange(s, m);
  });
  if (!touched.length) return [];
  const current = new Set((now.merges ?? []).map(rangeKey));
  // A merge shrunk by the deletion comes back only while it is still as the deletion left it (else someone
  // unmerged or remade it since); one the deletion dropped altogether always does.
  const leftAs = new Map<string, IdRange>();
  const back = new Set<IdRange>();
  for (const m of touched) {
    const s = shrunk(m, before, gone);
    const single = s !== null && s.r1 === s.r2 && s.c1 === s.c2;
    if (!s || single) back.add(m);
    else if (current.has(rangeKey(s))) {
      back.add(m);
      leftAs.set(rangeKey(s), m);
    }
  }
  if (!back.size) return [];
  const merges: IdRange[] = [];
  const placed = new Set<string>();
  for (const m of before.merges ?? []) {
    if (back.has(m)) merges.push(m);
    else if (current.has(rangeKey(m))) merges.push(m);
    else continue;
    placed.add(rangeKey(m));
  }
  for (const m of now.merges ?? []) {
    const key = rangeKey(m);
    if (!placed.has(key) && !leftAs.has(key)) merges.push(m);
  }
  return [{ k: 'merges', merges }];
}

// The filter's range as it was, with the deleted columns' conditions, over the conditions it has now.
function restoreFilter(
  before: SheetLayout,
  after: SheetLayout,
  now: SheetLayout,
  gone: Gone,
): LayoutChange[] {
  const was = before.filter;
  if (!was) return [];
  const goneConds: Record<string, FilterCondition> = {};
  for (const [col, cond] of Object.entries(was.conds))
    if (gone.cols.has(col)) goneConds[col] = cond;
  const left = after.filter;
  if (!left) return now.filter ? [] : [{ k: 'filter', filter: was }];
  if (sameRange(left, was) && !Object.keys(goneConds).length) return [];
  if (!now.filter || !sameRange(now.filter, left)) return [];
  return [
    { k: 'filter', filter: { ...idRangeOf(was), conds: { ...now.filter.conds, ...goneConds } } },
  ];
}

// Each named range the deletion shrank or dropped, back as it was, unless it has been set again since.
function restoreNames(before: SheetLayout, now: SheetLayout, gone: Gone): LayoutChange[] {
  const out: LayoutChange[] = [];
  for (const x of before.names ?? []) {
    const s = shrunk(x, before, gone);
    if (s && sameRange(s, x)) continue;
    const cur = now.names?.find((n) => sameName(n.name, x.name));
    if (s ? cur && sameRange(cur, s) : !cur)
      out.push({ k: 'name', name: x.name, range: idRangeOf(x) });
  }
  return out;
}

// A card table with what the deletion took from it (the deleted rows' links and drafts, its deleted columns and
// Controls column) put back into the table as it is now; a table the deletion ended comes back whole.
function restoreCardTables(
  before: SheetLayout,
  after: SheetLayout,
  now: SheetLayout,
  gone: Gone,
): LayoutChange[] {
  const out: LayoutChange[] = [];
  for (const t of before.cardTables ?? []) {
    const cur = now.cardTables?.find((x) => x.id === t.id);
    if (!after.cardTables?.some((x) => x.id === t.id)) {
      if (!cur) out.push({ k: 'cardTable', id: t.id, table: t });
      continue;
    }
    const links = Object.entries(t.rows).filter(([r]) => gone.rows.has(r));
    const drafts = (t.drafts ?? []).filter((r) => gone.rows.has(r));
    const cols = t.cols.filter((col) => gone.cols.has(col.c));
    const controls = t.controls && gone.cols.has(t.controls) ? t.controls : undefined;
    if (!cur || (!links.length && !drafts.length && !cols.length && !controls)) continue;
    // Columns in the table's old order, each as it is now; columns added since keep their place at the end.
    const kept = new Map(cur.cols.map((col) => [col.c, col]));
    const goneCol = new Set(cols.map((col) => col.c));
    const nextCols = t.cols.flatMap((col) =>
      kept.has(col.c) ? [kept.get(col.c)!] : goneCol.has(col.c) ? [col] : [],
    );
    const named = new Set(t.cols.map((col) => col.c));
    for (const col of cur.cols) if (!named.has(col.c)) nextCols.push(col);
    const nextDrafts = [...new Set([...(cur.drafts ?? []), ...drafts])];
    const nextControls = cur.controls ?? controls;
    const { drafts: _d, controls: _c, ...rest } = cur;
    const table: CardTable = {
      ...rest,
      cols: nextCols,
      rows: { ...cur.rows, ...Object.fromEntries(links) },
      ...(nextDrafts.length ? { drafts: nextDrafts } : {}),
      ...(nextControls ? { controls: nextControls } : {}),
    };
    out.push({ k: 'cardTable', id: t.id, table });
  }
  return out;
}

// The changes that undo `ch` (a deletion applied to `before`), landing on `now`.
export function inverseDelete(
  before: SheetLayout,
  ch: { k: 'deleteRows' | 'deleteCols'; ids: string[] },
  now: SheetLayout,
): LayoutChange[] {
  const rows = ch.k === 'deleteRows';
  const list = rows ? before.rows : before.cols;
  const has = new Set(list);
  const ids = new Set(ch.ids.filter((id) => has.has(id)));
  const none = new Set<string>();
  const gone: Gone = rows ? { rows: ids, cols: none } : { rows: none, cols: ids };
  const axis = rows ? 'r' : 'c';
  const out: LayoutChange[] = runsOf(list, ids).map((run) => ({
    k: rows ? 'insertRows' : 'insertCols',
    after: run.after,
    ids: run.ids,
  }));
  const sizes = rows ? before.rowSize : before.colSize;
  const bySize = new Map<number, string[]>();
  for (const id of ids) {
    const px = sizes?.[id];
    if (px !== undefined) bySize.set(px, [...(bySize.get(px) ?? []), id]);
  }
  for (const [px, list] of bySize) out.push({ k: 'size', axis, ids: list, px });
  const hidden = (rows ? before.hiddenRows : before.hiddenCols)?.filter((id) => ids.has(id));
  if (hidden?.length) out.push({ k: 'hide', axis, ids: hidden, hidden: true });
  out.push(
    rows
      ? { k: 'freeze', rows: before.frozenRows ?? 0 }
      : { k: 'freeze', cols: before.frozenCols ?? 0 },
  );
  const after = applyLayoutChange(before, ch);
  out.push(
    ...restoreMerges(before, now, gone),
    ...restoreFilter(before, after, now, gone),
    ...restoreCardTables(before, after, now, gone),
    ...restoreNames(before, now, gone),
  );
  return out;
}
