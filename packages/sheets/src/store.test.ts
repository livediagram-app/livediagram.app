import { describe, expect, it } from 'vitest';
import {
  applySheetWrite,
  inverseSheetWrite,
  mergeSheetChange,
  rebase,
  writeTouches,
  type SheetWrite,
} from './store';
import { cellKey, type Sheet } from './sheet';
import { makeSheets } from './testing/book';
import { renderFormula } from './formula/stored';
import { Workbook } from './engine/workbook';
import { reorderSlots } from './store-layout';
import { colWidth, rowHeight } from './layout';

const ctx = { now: 1, by: { id: 'p', name: 'P', color: '#000000' } };

function base(cells: Record<string, string> = {}): Sheet {
  return makeSheets({ 'Sheet 1': cells }, { rows: 8, cols: 4 })[0]!;
}

function snapshot(s: Sheet) {
  return {
    layout: s.layout,
    cells: [...s.cells].sort(([a], [b]) => a.localeCompare(b)),
    title: s.title,
  };
}

function roundTrip(s: Sheet, w: SheetWrite) {
  const r = applySheetWrite(s, w, ctx);
  const inv = inverseSheetWrite(s, r);
  const back = applySheetWrite(r.sheet, inv, ctx).sheet;
  expect(snapshot(back)).toEqual(snapshot(s));
  return r;
}

const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;

describe('applySheetWrite', () => {
  it('prunes card tables when their rows or columns are deleted, and undo restores them', () => {
    const s = base();
    const table = {
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
    const t = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table }] },
      ctx,
    ).sheet;
    const rows = roundTrip(t, { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(2)] }] });
    expect(rows.sheet.layout.cardTables).toEqual(
      [{ ...table, rows: { [R(1)]: 'i1' }, drafts: undefined }].map(({ drafts: _d, ...x }) => x),
    );
    const cols = roundTrip(t, {
      kind: 'layout',
      changes: [{ k: 'deleteCols', ids: [C(1), C(2)] }],
    });
    expect(cols.sheet.layout.cardTables![0]).toMatchObject({ cols: [{ c: C(0), field: 'Title' }] });
    expect(cols.sheet.layout.cardTables![0]!.controls).toBeUndefined();
    // The header row gone, the table goes.
    expect(
      roundTrip(t, { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(0)] }] }).sheet.layout
        .cardTables,
    ).toBeUndefined();
  });

  it('sets and removes a card table, undoably', () => {
    const s = base();
    const table = {
      id: 'tbl1',
      head: R(0),
      cols: [{ c: C(0), field: 'Title' }],
      rows: { [R(1)]: 'i1' },
      type: 'task',
    };
    const r = roundTrip(s, { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table }] });
    expect(r.sheet.layout.cardTables).toEqual([table]);
    const moved = { ...table, rows: { [R(2)]: 'i2' } };
    const again = roundTrip(r.sheet, {
      kind: 'layout',
      changes: [{ k: 'cardTable', id: 'tbl1', table: moved }],
    });
    expect(again.sheet.layout.cardTables).toEqual([moved]);
    expect(
      roundTrip(r.sheet, { kind: 'layout', changes: [{ k: 'cardTable', id: 'tbl1', table: null }] })
        .sheet.layout.cardTables,
    ).toBeUndefined();
  });

  it("sets the sheet's look and default sizes, and undoes it", () => {
    const s = base();
    const w: SheetWrite = {
      kind: 'layout',
      changes: [
        {
          k: 'options',
          showGrid: false,
          showHeaders: false,
          colWidth: 150,
          rowHeight: 32,
          setupPending: true,
        },
      ],
    };
    const r = roundTrip(s, w);
    expect(r.sheet.layout).toMatchObject({
      showGrid: false,
      showHeaders: false,
      colWidth: 150,
      rowHeight: 32,
    });
    expect(rowHeight(r.sheet.layout, R(0))).toBe(32);
    expect(colWidth(r.sheet.layout, C(0))).toBe(150);
    // Back to the defaults: shown again, sizes cleared.
    const back = applySheetWrite(
      r.sheet,
      {
        kind: 'layout',
        changes: [
          { k: 'options', showGrid: true, showHeaders: true, colWidth: null, rowHeight: null },
        ],
      },
      ctx,
    ).sheet.layout;
    expect(['showGrid', 'showHeaders', 'colWidth', 'rowHeight'].some((k) => k in back)).toBe(false);
    // A line sized on its own keeps its size.
    const sized = applySheetWrite(
      s,
      {
        kind: 'layout',
        changes: [
          { k: 'size', axis: 'c', ids: [C(1)], px: 60 },
          { k: 'options', colWidth: 150 },
        ],
      },
      ctx,
    ).sheet.layout;
    expect([colWidth(sized, C(0)), colWidth(sized, C(1))]).toEqual([150, 60]);
  });
  it('sets, clears and formats cells, skipping gone ids', () => {
    const s = base({ A1: '1' });
    const r = applySheetWrite(
      s,
      {
        kind: 'cells',
        cells: [
          { r: R(0), c: C(0), i: null, f: { b: true } },
          { r: R(1), c: C(1), i: { s: 'x' } },
          { r: 'gone', c: C(0), i: { n: 1 } },
        ],
      },
      ctx,
    );
    expect(r.sheet.cells.get(cellKey(R(0), C(0)))).toEqual({ format: { b: true } });
    expect(r.sheet.cells.get(cellKey(R(1), C(1)))).toEqual({ input: { s: 'x' } });
    expect(r.applied).toEqual({ kind: 'cells', cells: expect.arrayContaining([]) });
    expect((r.applied as { cells: unknown[] }).cells).toHaveLength(2);
    expect(r.sheet.rev).toBe(1);
    expect(r.sheet.layout).toBe(s.layout);
    const cleared = applySheetWrite(
      r.sheet,
      { kind: 'cells', cells: [{ r: R(0), c: C(0), f: null }] },
      ctx,
    );
    expect(cleared.sheet.cells.has(cellKey(R(0), C(0)))).toBe(false);
  });
  it('renames', () => {
    const r = roundTrip(base(), { kind: 'title', title: 'Budget' });
    expect(r.sheet.title).toBe('Budget');
    expect(r.touched).toEqual([]);
  });
  it('inserts, deletes and moves rows, keeping cells on their ids', () => {
    const s = base({ A1: 'a', A2: 'b', A3: 'c' });
    const ins = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'insertRows', after: R(0), ids: ['newr'] }],
    });
    expect(ins.sheet.layout.rows.slice(0, 3)).toEqual([R(0), 'newr', R(1)]);
    const del = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'deleteRows', ids: [R(1), 'gone'] }],
    });
    expect(del.sheet.layout.rows).not.toContain(R(1));
    expect(del.sheet.cells.has(cellKey(R(1), C(0)))).toBe(false);
    const mv = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'moveRows', ids: [R(2)], after: null }],
    });
    expect(mv.sheet.layout.rows[0]).toBe(R(2));
    roundTrip(s, { kind: 'layout', changes: [{ k: 'insertCols', after: null, ids: ['newc'] }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'deleteCols', ids: [C(0)] }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'moveCols', ids: [C(0)], after: C(2) }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'orderRows', ids: [R(2), R(1), R(0)] }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'orderCols', ids: [C(1), C(0)] }] });
  });
  it('sizes, hides, freezes, merges and filters, all undoable', () => {
    const s = base({ A1: 'a' });
    const sized = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'size', axis: 'c', ids: [C(0), 'gone'], px: 150 }],
    });
    expect(sized.sheet.layout.colSize).toEqual({ [C(0)]: 150 });
    roundTrip(sized.sheet, {
      kind: 'layout',
      changes: [{ k: 'size', axis: 'c', ids: [C(0), C(1)], px: null }],
    });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'size', axis: 'r', ids: [R(0)], px: 40 }] });
    const hid = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'hide', axis: 'r', ids: [R(2), R(1)], hidden: true }],
    });
    expect(hid.sheet.layout.hiddenRows).toEqual([R(1), R(2)].sort());
    roundTrip(hid.sheet, {
      kind: 'layout',
      changes: [{ k: 'hide', axis: 'r', ids: [R(1), R(3)], hidden: false }],
    });
    roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'hide', axis: 'c', ids: [C(1)], hidden: true }],
    });
    const frozen = roundTrip(s, { kind: 'layout', changes: [{ k: 'freeze', rows: 2, cols: 1 }] });
    expect([frozen.sheet.layout.frozenRows, frozen.sheet.layout.frozenCols]).toEqual([2, 1]);
    const range = { r1: R(0), c1: C(0), r2: R(1), c2: C(1) };
    const merged = roundTrip(s, { kind: 'layout', changes: [{ k: 'merge', range }] });
    expect(merged.sheet.layout.merges).toEqual([range]);
    roundTrip(merged.sheet, { kind: 'layout', changes: [{ k: 'unmerge', range }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'unmerge', range }] });
    roundTrip(merged.sheet, { kind: 'layout', changes: [{ k: 'merge', range }] });
    roundTrip(s, { kind: 'layout', changes: [{ k: 'merge', range: { ...range, r1: 'gone' } }] });
    const filter = { r1: R(0), c1: C(0), r2: R(5), c2: C(2), conds: {} };
    const filtered = roundTrip(s, { kind: 'layout', changes: [{ k: 'filter', filter }] });
    const cond = roundTrip(filtered.sheet, {
      kind: 'layout',
      changes: [{ k: 'filterCond', col: C(1), cond: { op: 'gt', a: '3' } }],
    });
    roundTrip(cond.sheet, {
      kind: 'layout',
      changes: [{ k: 'filterCond', col: C(1), cond: null }],
    });
    roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'filterCond', col: C(1), cond: { op: 'empty' } }],
    });
  });
  it('shrinks merges, the filter and frozen rows when rows go', () => {
    const range = { r1: R(0), c1: C(0), r2: R(2), c2: C(1) };
    const s0 = applySheetWrite(
      base(),
      {
        kind: 'layout',
        changes: [
          { k: 'merge', range },
          { k: 'merge', range: { r1: R(4), c1: C(0), r2: R(4), c2: C(1) } },
          { k: 'filter', filter: { ...range, conds: { [C(1)]: { op: 'empty' } } } },
          { k: 'freeze', rows: 2 },
          { k: 'size', axis: 'r', ids: [R(0)], px: 50 },
          { k: 'hide', axis: 'r', ids: [R(0)], hidden: true },
        ],
      },
      ctx,
    ).sheet;
    const r = roundTrip(s0, { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(0), R(4)] }] });
    expect(r.sheet.layout.merges).toEqual([{ ...range, r1: R(1) }]);
    expect(r.sheet.layout.filter).toMatchObject({ r1: R(1) });
    expect(r.sheet.layout.frozenRows).toBe(1);
    expect(r.sheet.layout.rowSize).toBeUndefined();
    const cols = roundTrip(s0, {
      kind: 'layout',
      changes: [{ k: 'deleteCols', ids: [C(0), C(1)] }],
    });
    expect(cols.sheet.layout.filter).toBeUndefined();
    expect(cols.sheet.layout.merges).toBeUndefined();
  });
  it('shrinks this sheet’s formula ranges when their corners go, and undoes it', () => {
    const s = base({
      A1: '1',
      A2: '2',
      A3: '3',
      D5: '=SUM(A1:A3)',
      D6: '=A1',
      D7: '=SUM(A:A)',
      D8: '=SUM(A1:B1)',
    });
    const r = roundTrip(s, { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(0)] }] });
    const wb = new Workbook({ sheets: [r.sheet], locale: 'en' });
    const ctxOf = wb.ctxFor(r.sheet.id);
    const text = (row: number) => {
      const input = r.sheet.cells.get(cellKey(R(row), C(3)))?.input as { f: never };
      return renderFormula(input.f, ctxOf);
    };
    expect(text(4)).toBe('=SUM(A1:A2)');
    expect(text(5)).toBe('=#REF!');
    expect(text(6)).toBe('=SUM(A:A)');
    expect(text(7)).toBe('=SUM(#REF!)');
    expect(wb.value(r.sheet.id, 3, 3)).toBe(5);
    const both = roundTrip(s, {
      kind: 'layout',
      changes: [{ k: 'deleteRows', ids: [R(0), R(1), R(2)] }],
    });
    expect(both.sheet.layout.rows[0]).toBe(R(3));
    const cols = roundTrip(s, { kind: 'layout', changes: [{ k: 'deleteCols', ids: [C(0)] }] });
    expect(cols.applied.kind).toBe('layout');
  });
  it('puts formats back exactly on undo', () => {
    const s = applySheetWrite(
      base(),
      { kind: 'cells', cells: [{ r: R(0), c: C(0), f: { b: true } }] },
      ctx,
    ).sheet;
    roundTrip(s, { kind: 'cells', cells: [{ r: R(0), c: C(0), f: { i: true, b: null } }] });
    roundTrip(s, { kind: 'cells', cells: [{ r: R(0), c: C(0), f: null }] });
  });
  it('round-trips random writes (property)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
    let s = base({ A1: '1', B2: '=A1*2', C3: 'x' });
    for (let n = 0; n < 3000; n++) {
      const rows = s.layout.rows;
      const cols = s.layout.cols;
      const kind = pick(['cells', 'insert', 'delete', 'move', 'size', 'hide', 'merge']);
      let w: SheetWrite;
      if (kind === 'cells')
        w = {
          kind: 'cells',
          cells: [
            {
              r: pick(rows),
              c: pick(cols),
              i: rand() < 0.3 ? null : { n: n },
              f: rand() < 0.5 ? { b: true } : undefined,
            },
          ],
        };
      else if (kind === 'insert')
        w = {
          kind: 'layout',
          changes: [{ k: 'insertRows', after: pick([null, ...rows]), ids: [`n${n}aa`] }],
        };
      else if (kind === 'delete' && rows.length > 3)
        w = { kind: 'layout', changes: [{ k: 'deleteRows', ids: [pick(rows)] }] };
      else if (kind === 'move')
        w = {
          kind: 'layout',
          changes: [{ k: 'moveCols', ids: [pick(cols)], after: pick([null, ...cols]) }],
        };
      else if (kind === 'size')
        w = {
          kind: 'layout',
          changes: [{ k: 'size', axis: 'r', ids: [pick(rows)], px: rand() < 0.5 ? null : 30 }],
        };
      else if (kind === 'hide')
        w = {
          kind: 'layout',
          changes: [{ k: 'hide', axis: 'c', ids: [pick(cols)], hidden: rand() < 0.5 }],
        };
      else w = { kind: 'layout', changes: [{ k: 'freeze', rows: Math.floor(rand() * 3) }] };
      s = roundTrip(s, w).sheet;
    }
  });
});

describe('merging and rebasing', () => {
  it('applies in order, ignores repeats, refetches on a gap', () => {
    const s = base();
    const op = {
      rev: 1,
      applied: { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { n: 1 } }] } as SheetWrite,
      at: 1,
      by: ctx.by,
    };
    const m = mergeSheetChange(s, op);
    expect(m.kind).toBe('applied');
    if (m.kind === 'applied') {
      expect(m.sheet.rev).toBe(1);
      expect(mergeSheetChange(m.sheet, op).kind).toBe('duplicate');
    }
    expect(mergeSheetChange(s, { ...op, rev: 5 }).kind).toBe('refetch');
  });
  it('lays pending writes over the confirmed sheet', () => {
    const s = base();
    const r = rebase(
      s,
      [
        { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { n: 1 } }] },
        { kind: 'title', title: 'X' },
      ],
      ctx,
    );
    expect(r.sheet.title).toBe('X');
    expect(r.sheet.rev).toBe(0);
    expect(r.touched).toEqual([cellKey(R(0), C(0))]);
  });
  it('names the cells a write touches and reorders slots', () => {
    expect(writeTouches({ kind: 'title', title: 'x' })).toEqual([]);
    expect(writeTouches({ kind: 'layout', changes: [] })).toEqual([]);
    expect(writeTouches({ kind: 'cells', cells: [{ r: 'a', c: 'b' }] })).toEqual(['a:b']);
    expect(reorderSlots(['a', 'b', 'X', 'c'], ['c', 'a', 'b', 'gone'])).toEqual([
      'c',
      'a',
      'X',
      'b',
    ]);
  });
});
