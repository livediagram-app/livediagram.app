import { describe, expect, it } from 'vitest';
import { makeSheets } from './testing/book';
import { Workbook } from './engine/workbook';
import { moveAxis, sortFilter, sortRange, sortSheet } from './commands-axis';
import { mergeRange } from './commands';
import { applySheetWrite, type SheetWrite } from './store';
import { validateWrite } from './validate';
import { MERGE_SORT_REFUSAL, mergeMoveRefusal } from './merge-guards';
import type { Sheet } from './sheet';

// docs/specs/029-sheets/sheet.md "Sort", "Rows and columns": a sort or move that would pull a merge's rows apart is
// refused, as in Google Sheets. It used to stretch the merge over whatever landed between, over other merges, and the
// sheet then refused every typed value (merge_invalid).
const ctx = { now: 1, by: { id: 'p', name: 'P', color: '#000000' } };
const apply = (s: Sheet, w: SheetWrite) => applySheetWrite(s, w, ctx).sheet;
const merged = (s: Sheet, r1: number, c1: number, r2: number, c2: number) =>
  apply(s, mergeRange(s, { r1, c1, r2, c2 }, 'all')!.write);

function sheet(): Sheet {
  return makeSheets(
    { 'Sheet 1': { A1: '5', A2: '1', A3: '9', A4: '3', A5: '7', B2: 'merged' } },
    { rows: 6, cols: 3 },
  )[0]!;
}
const wbOf = (s: Sheet) => new Workbook({ sheets: [s], locale: 'en-GB' });

describe('sorting past a merge', () => {
  it('refuses to sort the sheet over a merge across rows, and sorts one within a row', () => {
    const down = merged(sheet(), 1, 1, 2, 2);
    expect(sortSheet(wbOf(down), down.id, 0, true)).toEqual({ refused: MERGE_SORT_REFUSAL });
    const across = merged(sheet(), 1, 1, 1, 2);
    expect(sortSheet(wbOf(across), across.id, 0, true)).toMatchObject({ kind: 'layout' });
  });

  it('refuses a filter sort over one, and a range sort only when the merge is in its range', () => {
    let s = merged(sheet(), 1, 1, 2, 2);
    s = apply(s, {
      kind: 'layout',
      changes: [
        {
          k: 'filter',
          filter: {
            r1: s.layout.rows[0]!,
            c1: s.layout.cols[0]!,
            r2: s.layout.rows[4]!,
            c2: s.layout.cols[2]!,
            conds: {},
          },
        },
      ],
    });
    expect(sortFilter(wbOf(s), s.id, s.layout.cols[0]!, true)).toEqual({
      refused: MERGE_SORT_REFUSAL,
    });
    expect(
      sortRange(
        wbOf(s),
        s.id,
        { r1: 0, c1: 0, r2: 4, c2: 0 },
        [{ col: 0, ascending: true }],
        false,
      ),
    ).toMatchObject({ kind: 'cells' });
    expect(
      sortRange(
        wbOf(s),
        s.id,
        { r1: 0, c1: 0, r2: 4, c2: 1 },
        [{ col: 0, ascending: true }],
        false,
      ),
    ).toEqual({ refused: MERGE_SORT_REFUSAL });
  });
});

describe('moving lines past a merge', () => {
  const s = () => merged(sheet(), 1, 1, 2, 2);

  it('refuses moving part of a merge, or landing inside one', () => {
    expect(moveAxis(s(), 'r', 1, 1, 5)).toEqual({ refused: mergeMoveRefusal('r') });
    expect(moveAxis(s(), 'r', 4, 4, 2)).toEqual({ refused: mergeMoveRefusal('r') });
    expect(moveAxis(s(), 'c', 1, 1, 0)).toEqual({ refused: mergeMoveRefusal('c') });
  });

  it('moves a whole merge, and lines past it', () => {
    expect(moveAxis(s(), 'r', 1, 2, 5)).toMatchObject({ kind: 'layout' });
    expect(moveAxis(s(), 'r', 4, 4, 0)).toMatchObject({ kind: 'layout' });
    expect(moveAxis(s(), 'r', 4, 4, 1)).toMatchObject({ kind: 'layout' });
  });
});

describe('the api check on merges', () => {
  const twoMerges = () => merged(merged(sheet(), 1, 1, 2, 2), 3, 1, 3, 2);
  it('refuses a reorder that pulls a merge over another, though it adds nothing', () => {
    const s = twoMerges();
    const [, r1, r2, r3] = s.layout.rows;
    // Rows 2 and 3 hold one merge, row 4 the other: 2, 4, 3 stretches the first over the second.
    const w: SheetWrite = { kind: 'layout', changes: [{ k: 'orderRows', ids: [r1!, r3!, r2!] }] };
    expect(validateWrite(s, w)).toMatchObject({ ok: false, error: 'merge_invalid' });
    const fine: SheetWrite = {
      kind: 'layout',
      changes: [{ k: 'orderRows', ids: [r3!, r1!, r2!] }],
    };
    expect(validateWrite(s, fine)).toEqual({ ok: true });
  });

  it('lets a sheet a sort once broke take typed values, but not more merges', () => {
    const s = twoMerges();
    // Rows 2 and 3 (the first merge's corners) pulled apart around row 4 (the second merge).
    const broken = apply(s, {
      kind: 'layout',
      changes: [{ k: 'moveRows', ids: [s.layout.rows[2]!], after: s.layout.rows[3]! }],
    });
    expect(
      validateWrite(s, {
        kind: 'layout',
        changes: [{ k: 'moveRows', ids: [s.layout.rows[2]!], after: s.layout.rows[3]! }],
      }),
    ).toMatchObject({ ok: false, error: 'merge_invalid' });
    const typed: SheetWrite = {
      kind: 'cells',
      cells: [{ r: broken.layout.rows[5]!, c: broken.layout.cols[0]!, i: { s: 'x' } }],
    };
    expect(validateWrite(broken, typed)).toEqual({ ok: true });
    const more = mergeRange(broken, { r1: 5, c1: 0, r2: 5, c2: 1 }, 'all')!.write;
    expect(validateWrite(broken, more)).toMatchObject({ ok: false, error: 'merge_invalid' });
  });
});
