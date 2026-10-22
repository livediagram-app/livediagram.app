import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { applySheetWrite, type SheetWrite } from './store';
import { shiftCells } from './commands-shift';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
function apply(b: ReturnType<typeof book>, sheetId: string, w: SheetWrite) {
  const i = b.sheets.findIndex((s) => s.id === sheetId);
  const r = applySheetWrite(b.sheets[i]!, w, ctx);
  b.sheets[i] = r.sheet;
  b.wb.updateSheet(r.sheet, w.kind === 'cells' ? r.touched : undefined);
}
const run = (
  b: ReturnType<typeof book>,
  range: { r1: number; c1: number; r2: number; c2: number },
  mode: Parameters<typeof shiftCells>[3],
) => {
  const id = b.sheets[0]!.id;
  const res = shiftCells(b.wb, id, range, mode);
  for (const e of res?.edits ?? []) apply(b, e.sheetId, e.write);
  return res;
};

describe('insert and delete cells', () => {
  it('inserts cells by moving the column below down, formulas following', () => {
    const b = book({ A1: '1', A2: '2', A3: '3', B1: '=SUM(A2:A3)', C1: '=A3' });
    run(b, { r1: 1, c1: 0, r2: 1, c2: 0 }, 'insertDown');
    expect([b.v('A1'), b.v('A2'), b.v('A3'), b.v('A4')]).toEqual([1, null, 2, 3]);
    expect([b.v('B1'), b.v('C1')]).toEqual([5, 3]);
  });

  it('inserts cells to the right, moving the row along', () => {
    const b = book({ A1: 'a', B1: 'b', C1: 'c' });
    run(b, { r1: 0, c1: 1, r2: 0, c2: 1 }, 'insertRight');
    expect([b.v('A1'), b.v('B1'), b.v('C1'), b.v('D1')]).toEqual(['a', null, 'b', 'c']);
  });

  it('deletes cells, closing the gap from below or the right', () => {
    const b = book({ A1: '1', A2: '2', A3: '3', A4: '4', C1: '=A4' });
    run(b, { r1: 1, c1: 0, r2: 2, c2: 0 }, 'deleteUp');
    expect([b.v('A1'), b.v('A2'), b.v('A3'), b.v('A4')]).toEqual([1, 4, null, null]);
    expect(b.v('C1')).toBe(4);
    const r = book({ A1: 'a', B1: 'b', C1: 'c' });
    run(r, { r1: 0, c1: 0, r2: 0, c2: 0 }, 'deleteLeft');
    expect([r.v('A1'), r.v('B1'), r.v('C1')]).toEqual(['b', 'c', null]);
  });

  it('only clears a deleted range with nothing beyond it, and does nothing past the filled cells', () => {
    const b = book({ A1: '1', A2: '2' });
    run(b, { r1: 1, c1: 0, r2: 1, c2: 0 }, 'deleteUp');
    expect([b.v('A1'), b.v('A2')]).toEqual([1, null]);
    expect(
      shiftCells(b.wb, b.sheets[0]!.id, { r1: 5, c1: 0, r2: 5, c2: 0 }, 'insertDown'),
    ).toBeNull();
    expect(
      shiftCells(b.wb, b.sheets[0]!.id, { r1: 5, c1: 0, r2: 5, c2: 0 }, 'deleteUp'),
    ).toBeNull();
    expect(shiftCells(b.wb, 'nope', { r1: 0, c1: 0, r2: 0, c2: 0 }, 'deleteUp')).toBeNull();
  });
});
