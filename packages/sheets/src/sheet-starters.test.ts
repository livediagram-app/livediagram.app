import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { applySheetWrite, type SheetWrite } from './store';
import { validateWrite } from './validate';
import {
  cardsStarter,
  resetSheetWrite,
  setupWrite,
  sheetStarter,
  SHEET_STARTS,
  type SheetSetup,
} from './sheet-starters';
import { cellKey } from './sheet';
import { colWidth, rowHeight } from './layout';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
const NOW = Date.UTC(2026, 9, 9);

function setUp(setup: Partial<SheetSetup> & Pick<SheetSetup, 'start'>, rows = 10) {
  const b = book({}, { rows, cols: 6 });
  const s = b.sheets[0]!;
  const w = setupWrite(b.wb, s.id, {
    look: 'header',
    freezeHeader: true,
    size: 'default',
    dark: false,
    ...setup,
  });
  expect(w).not.toBeNull();
  expect(validateWrite(s, w as SheetWrite)).toEqual({ ok: true });
  const next = applySheetWrite(s, w!, ctx).sheet;
  b.wb.updateSheet(next);
  const at = (r: number, c: number) =>
    next.cells.get(cellKey(next.layout.rows[r]!, next.layout.cols[c]!));
  return { next, at, wb: b.wb };
}

describe('the setup starts', () => {
  it('fills a budget with a header, amounts and a live total, styled and frozen', () => {
    const { next, at, wb } = setUp({ start: sheetStarter('budget', NOW) });
    expect(at(0, 0)).toMatchObject({ input: { s: 'Item' }, format: { b: true, bg: '#e0f2fe' } });
    expect(at(1, 2)).toMatchObject({ input: { n: 1200 }, format: { nf: 'number', dp: 2 } });
    expect(at(5, 0)?.format?.b).toBe(true);
    expect(wb.value(next.id, 5, 2)).toBe(1840);
    expect(next.layout.frozenRows).toBe(1);
    expect(next.layout.setupPending).toBeUndefined();
    expect(colWidth(next.layout, next.layout.cols[0]!)).toBe(180);
  });

  it('dates the tracker from today and fills every start', () => {
    const { at } = setUp({ start: sheetStarter('tracker', NOW) });
    expect(at(1, 3)).toMatchObject({ format: { nf: 'date' } });
    for (const id of SHEET_STARTS) expect(sheetStarter(id, NOW) === null).toBe(id === 'blank');
    expect(setUp({ start: sheetStarter('timesheet', NOW) }).wb).toBeTruthy();
    expect(setUp({ start: sheetStarter('contacts', NOW) }).at(1, 1)?.input).toEqual({
      s: 'jordan@example.com',
    });
  });

  it('draws each look, dark tints included', () => {
    const start = sheetStarter('budget', NOW);
    expect(setUp({ start, look: 'plain' }).at(0, 0)?.format).toBeUndefined();
    const banded = setUp({ start, look: 'banded', dark: true });
    expect(banded.at(0, 0)?.format?.bg).toBe('#1f3a56');
    expect(banded.at(2, 0)?.format?.bg).toBe('#1a2433');
    expect(banded.at(1, 0)?.format?.bg).toBeUndefined();
    expect(setUp({ start, look: 'boxed' }).at(3, 1)?.format?.bt).toMatchObject({ w: 1 });
    const minimal = setUp({ start, look: 'minimal' });
    expect(minimal.next.layout.showGrid).toBe(false);
    expect(minimal.at(0, 0)?.format).toEqual({ b: true });
  });

  it('sets a blank sheet up with its size alone, no freeze', () => {
    const { next } = setUp({ start: null, size: 'roomy' });
    expect(next.cells.size).toBe(0);
    expect([rowHeight(next.layout, next.layout.rows[0]!), next.layout.frozenRows]).toEqual([
      36,
      undefined,
    ]);
    expect(setUp({ start: null, size: 'compact' }).next.layout.colWidth).toBe(100);
  });

  it('writes cards as rows, growing the sheet to fit', () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ key: i + 1 }));
    const start = cardsStarter(['Number', 'Title', 'Due', 'Done'], cards, (c, f) =>
      f === 'Number'
        ? c.key
        : f === 'Title'
          ? `Card ${c.key}`
          : f === 'Due'
            ? 46000
            : f === 'Done'
              ? true
              : null,
    );
    const { next, at } = setUp({ start }, 5);
    expect(next.layout.rows.length).toBe(13);
    expect(at(0, 1)?.input).toEqual({ s: 'Title' });
    expect(at(12, 0)?.input).toEqual({ n: 12 });
    expect(at(3, 2)).toMatchObject({ input: { n: 46000 }, format: { nf: 'date' } });
    expect(at(3, 3)?.input).toEqual({ s: 'true' });
    expect(cardsStarter(['Title'], [{ key: 1 }], () => '').rows[1]).toEqual([null]);
  });

  it('is null for a sheet that is gone or a formula that cannot be read', () => {
    const b = book({});
    const setup: SheetSetup = {
      start: null,
      look: 'plain',
      freezeHeader: false,
      size: 'default',
      dark: false,
    };
    expect(setupWrite(b.wb, 'nope', setup)).toBeNull();
    expect(
      setupWrite(b.wb, b.sheets[0]!.id, { ...setup, start: { rows: [['=SUM(']] } }),
    ).toBeNull();
  });

  it('links the card rows as a card table', () => {
    const cards = [
      { key: 1, id: 'item1' },
      { key: 2, id: 'item2' },
    ];
    const start = cardsStarter(
      ['Number', 'Title'],
      cards,
      (c, f) => (f === 'Number' ? c.key : 'T'),
      'task',
    );
    const { next } = setUp({ start });
    const [t] = next.layout.cardTables!;
    expect(t).toMatchObject({ head: next.layout.rows[0], type: 'task' });
    expect(t!.cols.map((c) => c.field)).toEqual(['Number', 'Title']);
    expect(t!.rows).toEqual({ [next.layout.rows[1]!]: 'item1', [next.layout.rows[2]!]: 'item2' });
    // The next column holds the rows' Save and Cancel.
    expect(t!.controls).toBe(next.layout.cols[2]);
    expect(colWidth(next.layout, next.layout.cols[2]!)).toBe(72);
    // No columns past Controls: nothing there would reach a card.
    expect(next.layout.cols).toHaveLength(3);
    // Without ids or a type the rows are a copy.
    expect(cardsStarter(['Title'], [{ key: 1 }], () => 'x', 'task').cards).toBeUndefined();
  });

  it('resets a set-up sheet to how a placed one starts, awaiting setup again', () => {
    const { next } = setUp({ start: sheetStarter('budget', NOW), look: 'banded', size: 'roomy' });
    const messy = applySheetWrite(
      next,
      {
        kind: 'layout',
        changes: [
          { k: 'hide', axis: 'r', ids: [next.layout.rows[7]!], hidden: true },
          { k: 'hide', axis: 'c', ids: [next.layout.cols[5]!], hidden: true },
          { k: 'size', axis: 'r', ids: [next.layout.rows[2]!], px: 50 },
          {
            k: 'merge',
            range: {
              r1: next.layout.rows[8]!,
              c1: next.layout.cols[0]!,
              r2: next.layout.rows[8]!,
              c2: next.layout.cols[1]!,
            },
          },
          {
            k: 'filter',
            filter: {
              r1: next.layout.rows[0]!,
              c1: next.layout.cols[0]!,
              r2: next.layout.rows[5]!,
              c2: next.layout.cols[2]!,
              conds: {},
            },
          },
          { k: 'freeze', cols: 1 },
          {
            k: 'cardTable',
            id: 'tbl1',
            table: {
              id: 'tbl1',
              head: next.layout.rows[0]!,
              cols: [{ c: next.layout.cols[0]!, field: 'Title' }],
              rows: {},
              type: 'task',
            },
          },
          { k: 'options', showGrid: false, showHeaders: false },
        ],
      },
      ctx,
    ).sheet;
    const w = resetSheetWrite(messy);
    expect(validateWrite(messy, w)).toEqual({ ok: true });
    const reset = applySheetWrite(messy, w, ctx).sheet;
    expect(reset.cells.size).toBe(0);
    expect(reset.layout).toEqual({
      rows: messy.layout.rows,
      cols: messy.layout.cols,
      setupPending: true,
    });
    // A fresh sheet resets to the same.
    const fresh = book({}).sheets[0]!;
    expect(applySheetWrite(fresh, resetSheetWrite(fresh), ctx).sheet.layout).toEqual({
      ...fresh.layout,
      setupPending: true,
    });
  });
});
