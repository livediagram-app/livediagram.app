import { describe, expect, it } from 'vitest';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from './store';
import type { CardTable, Sheet } from './sheet';
import { makeSheets } from './testing/book';

const ctx = { now: 1, by: { id: 'p', name: 'P', color: '#000000' } };
const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;

const apply = (s: Sheet, w: SheetWrite) => applySheetWrite(s, w, ctx);
const layoutWrite = (
  ...changes: Extract<SheetWrite, { kind: 'layout' }>['changes']
): SheetWrite => ({
  kind: 'layout',
  changes,
});

const TABLE: CardTable = {
  id: 'tbl1',
  head: R(0),
  cols: [
    { c: C(0), field: 'Title' },
    { c: C(1), field: 'State' },
  ],
  rows: { [R(1)]: 'i1', [R(2)]: 'i2' },
  type: 'task',
  drafts: [R(2)],
  controls: C(2),
};

function withTable(): Sheet {
  const s = makeSheets({ 'Sheet 1': {} }, { rows: 8, cols: 4 })[0]!;
  return apply(s, layoutWrite({ k: 'cardTable', id: 'tbl1', table: TABLE })).sheet;
}

// The deletion, a change someone made after it, then the undo made against the sheet as it is by then.
function undoAfter(s: Sheet, del: SheetWrite, since: SheetWrite): Sheet {
  const deleted = apply(s, del);
  const later = apply(deleted.sheet, since).sheet;
  return apply(later, inverseSheetWrite(s, deleted, later.layout)).sheet;
}

// docs/specs/029-sheets/sheet-store.md "Undo": an undo puts back what its layout change touched, nothing more.
describe('undoing a deletion over later changes', () => {
  it('keeps a card table link and draft made after the deletion', () => {
    const s = withTable();
    const since = layoutWrite({
      k: 'cardTable',
      id: 'tbl1',
      table: { ...TABLE, rows: { [R(1)]: 'i1', [R(3)]: 'i3' }, drafts: [R(1)] },
    });
    const back = undoAfter(s, layoutWrite({ k: 'deleteRows', ids: [R(2)] }), since);
    const table = back.layout.cardTables![0]!;
    expect(table.rows).toEqual({ [R(1)]: 'i1', [R(2)]: 'i2', [R(3)]: 'i3' });
    expect(table.drafts).toEqual([R(1), R(2)]);
  });

  it('puts a deleted column back into the table without dropping a column added since', () => {
    const s = withTable();
    const since = layoutWrite({
      k: 'cardTable',
      id: 'tbl1',
      table: {
        ...TABLE,
        cols: [
          { c: C(0), field: 'Title' },
          { c: C(3), field: 'Due' },
        ],
      },
    });
    const back = undoAfter(s, layoutWrite({ k: 'deleteCols', ids: [C(1)] }), since);
    expect(back.layout.cardTables![0]!.cols.map((col) => col.c)).toEqual([C(0), C(1), C(3)]);
  });

  it('brings back a table the deletion ended, but never one removed since', () => {
    const s = withTable();
    const del = layoutWrite({ k: 'deleteRows', ids: [R(0)] });
    expect(undoAfter(s, del, { kind: 'cells', cells: [] }).layout.cardTables).toEqual([TABLE]);
    const removed = layoutWrite({ k: 'deleteRows', ids: [R(2)] });
    const since = layoutWrite({ k: 'cardTable', id: 'tbl1', table: null });
    expect(undoAfter(s, removed, since).layout.cardTables).toBeUndefined();
  });

  it('keeps a merge and a name made since, and restores the ones the deletion shrank', () => {
    const shrinks = { r1: R(0), c1: C(0), r2: R(2), c2: C(1) };
    const s = apply(
      withTable(),
      layoutWrite({ k: 'merge', range: shrinks }, { k: 'name', name: 'Top', range: shrinks }),
    ).sheet;
    const fresh = { r1: R(5), c1: C(0), r2: R(6), c2: C(1) };
    const since = layoutWrite(
      { k: 'merge', range: fresh },
      { k: 'name', name: 'Later', range: fresh },
    );
    const back = undoAfter(s, layoutWrite({ k: 'deleteRows', ids: [R(2)] }), since);
    expect(back.layout.merges).toEqual([shrinks, fresh]);
    expect(back.layout.names).toEqual(
      expect.arrayContaining([
        { name: 'Top', ...shrinks },
        { name: 'Later', ...fresh },
      ]),
    );
  });

  it('leaves a shrunk merge someone unmerged since, and a filter replaced since', () => {
    const shrinks = { r1: R(0), c1: C(0), r2: R(2), c2: C(1) };
    const s = apply(
      withTable(),
      layoutWrite(
        { k: 'merge', range: shrinks },
        { k: 'filter', filter: { ...shrinks, conds: {} } },
      ),
    ).sheet;
    const left = { ...shrinks, r2: R(1) };
    const other = { r1: R(4), c1: C(0), r2: R(6), c2: C(2), conds: {} };
    const since = layoutWrite({ k: 'unmerge', range: left }, { k: 'filter', filter: other });
    const back = undoAfter(s, layoutWrite({ k: 'deleteRows', ids: [R(2)] }), since);
    expect(back.layout.merges).toBeUndefined();
    expect(back.layout.filter).toEqual(other);
  });

  it("puts a deleted column's filter condition back over the conditions set since", () => {
    const range = { r1: R(0), c1: C(0), r2: R(5), c2: C(2) };
    const s = apply(
      withTable(),
      layoutWrite({ k: 'filter', filter: { ...range, conds: { [C(1)]: { op: 'empty' } } } }),
    ).sheet;
    const since = layoutWrite({ k: 'filterCond', col: C(0), cond: { op: 'gt', a: '1' } });
    const back = undoAfter(s, layoutWrite({ k: 'deleteCols', ids: [C(1)] }), since);
    expect(back.layout.filter).toEqual({
      ...range,
      conds: { [C(0)]: { op: 'gt', a: '1' }, [C(1)]: { op: 'empty' } },
    });
  });
});
