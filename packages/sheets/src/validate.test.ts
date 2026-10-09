import { describe, expect, it } from 'vitest';
import { cellBytes, validInput, validateSheetCreate, validateWrite } from './validate';
import { makeSheets } from './testing/book';
import { cellKey, type Sheet } from './sheet';
import type { SheetWrite } from './store';

const base = (): Sheet =>
  makeSheets({ 'Sheet 1': { A1: '=SUM(B1:B2)' } }, { rows: 5, cols: 3 })[0]!;
const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;
const v = (w: unknown, s = base()) => validateWrite(s, w as SheetWrite);

describe('validateWrite', () => {
  it('accepts well-formed writes', () => {
    expect(
      v({ kind: 'cells', cells: [{ r: R(0), c: C(0), i: { n: 1 }, f: { b: true, i: null } }] }),
    ).toEqual({ ok: true });
    expect(v({ kind: 'title', title: 'Budget' })).toEqual({ ok: true });
    expect(
      v({ kind: 'layout', changes: [{ k: 'insertRows', after: null, ids: ['abcd12'] }] }),
    ).toEqual({ ok: true });
    expect(v({ kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(0)] }] })).toEqual({
      ok: true,
    });
    expect(v({ kind: 'layout', changes: [{ k: 'size', axis: 'c', ids: [C(0)], px: 50 }] })).toEqual(
      { ok: true },
    );
    expect(v({ kind: 'layout', changes: [{ k: 'filter', filter: null }] })).toEqual({ ok: true });
    expect(v({ kind: 'layout', changes: [{ k: 'merges', merges: [] }] })).toEqual({ ok: true });
  });
  it.each([
    [{ kind: 'nope' }, 'write_invalid'],
    [null, 'write_invalid'],
    [{ kind: 'title', title: '  ' }, 'title_invalid'],
    [{ kind: 'title', title: 'x'.repeat(61) }, 'title_invalid'],
    [{ kind: 'cells', cells: 'x' }, 'write_invalid'],
    [{ kind: 'cells', cells: [{ r: 'BAD', c: C(0) }] }, 'axis_id_invalid'],
    [{ kind: 'cells', cells: [{ r: R(0), c: C(0), i: { n: Infinity } }] }, 'write_invalid'],
    [{ kind: 'cells', cells: [{ r: R(0), c: C(0), i: { n: 1, s: 'x' } }] }, 'write_invalid'],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { s: 'x'.repeat(10_001) } }] },
      'input_too_long',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '@1', r: [{}] } } }] },
      'formula_invalid',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '1', r: [{}] } } }] },
      'formula_invalid',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '(((', r: [] } } }] },
      'formula_invalid',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: 'x'.repeat(8001), r: [] } } }] },
      'input_too_long',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '@0', r: [{ r1: 'BAD' }] } } }] },
      'write_invalid',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '@0', r: [{ zz: 1 }] } } }] },
      'write_invalid',
    ],
    [
      { kind: 'cells', cells: [{ r: R(0), c: C(0), i: { f: { t: '1', r: [], x: 1 } } }] },
      'write_invalid',
    ],
    [{ kind: 'cells', cells: [{ r: R(0), c: C(0), f: { b: 'yes' } }] }, 'format_invalid'],
    [
      { kind: 'cells', cells: Array.from({ length: 5001 }, () => ({ r: R(0), c: C(0) })) },
      'write_too_large',
    ],
    [
      {
        kind: 'cells',
        cells: [
          { r: R(0), c: C(0), i: { s: 'x'.repeat(9000) } },
          ...Array.from({ length: 200 }, () => ({ r: R(0), c: C(0), i: { s: 'y'.repeat(9000) } })),
        ],
      },
      'write_too_large',
    ],
    [{ kind: 'layout', changes: [] }, 'write_invalid'],
    [
      { kind: 'layout', changes: [{ k: 'insertRows', after: null, ids: [R(0)] }] },
      'axis_id_invalid',
    ],
    [
      { kind: 'layout', changes: [{ k: 'insertRows', after: null, ids: ['abcd12', 'abcd12'] }] },
      'axis_id_invalid',
    ],
    [
      { kind: 'layout', changes: [{ k: 'insertRows', after: 'BAD', ids: ['abcd12'] }] },
      'axis_id_invalid',
    ],
    [{ kind: 'layout', changes: [{ k: 'insertCols', after: null, ids: [] }] }, 'axis_id_invalid'],
    [{ kind: 'layout', changes: [{ k: 'deleteRows', ids: ['BAD'] }] }, 'axis_id_invalid'],
    [
      { kind: 'layout', changes: [{ k: 'moveRows', ids: [R(0)], after: 'BAD' }] },
      'axis_id_invalid',
    ],
    [{ kind: 'layout', changes: [{ k: 'size', axis: 'r', ids: [R(0)], px: 5 }] }, 'write_invalid'],
    [
      { kind: 'layout', changes: [{ k: 'size', axis: 'r', ids: ['BAD'], px: 50 }] },
      'axis_id_invalid',
    ],
    [
      { kind: 'layout', changes: [{ k: 'hide', axis: 'r', ids: [R(0)], hidden: 'y' }] },
      'write_invalid',
    ],
    [{ kind: 'layout', changes: [{ k: 'freeze', rows: 99 }] }, 'write_invalid'],
    [{ kind: 'layout', changes: [{ k: 'freeze', cols: -1 }] }, 'write_invalid'],
    [{ kind: 'layout', changes: [{ k: 'merge', range: { r1: 'BAD' } }] }, 'merge_invalid'],
    [{ kind: 'layout', changes: [{ k: 'merges', merges: 'x' }] }, 'merge_invalid'],
    [{ kind: 'layout', changes: [{ k: 'filter', filter: { r1: R(0) } }] }, 'filter_invalid'],
    [{ kind: 'layout', changes: [{ k: 'filterCond', col: 'BAD', cond: null }] }, 'filter_invalid'],
    [{ kind: 'layout', changes: [{ k: 'what' }] }, 'write_invalid'],
    [
      { kind: 'layout', changes: Array.from({ length: 101 }, () => ({ k: 'freeze', rows: 0 })) },
      'write_invalid',
    ],
    [
      {
        kind: 'layout',
        changes: [
          {
            k: 'insertCols',
            after: null,
            ids: Array.from({ length: 198 }, (_, i) => `zz${String(i).padStart(4, '0')}`),
          },
        ],
      },
      'sheet_too_large',
    ],
  ])('%j is %s', (w, error) => {
    expect(v(w)).toMatchObject({ ok: false, error });
  });
  it('refuses overlapping merges and too many merges', () => {
    const s = base();
    const m = (r1: number, c1: number, r2: number, c2: number) => ({
      k: 'merge',
      range: { r1: R(r1), c1: C(c1), r2: R(r2), c2: C(c2) },
    });
    expect(v({ kind: 'layout', changes: [m(0, 0, 1, 1), m(1, 1, 2, 2)] }, s)).toMatchObject({
      error: 'merge_invalid',
    });
    expect(v({ kind: 'layout', changes: [m(0, 0, 1, 1), m(2, 0, 3, 1)] }, s)).toEqual({ ok: true });
  });
  it('refuses a full sheet, but lets an oversized sheet shrink', () => {
    const s = base();
    const cells = new Map(s.cells);
    for (let i = 0; i < 50_000; i++) cells.set(cellKey(`x${i}`, 'y'), { input: { n: i } });
    const full = { ...s, cells };
    expect(v({ kind: 'cells', cells: [{ r: R(1), c: C(1), i: { n: 1 } }] }, full)).toMatchObject({
      error: 'sheet_full',
    });
    expect(v({ kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(1)] }] }, full)).toEqual({
      ok: true,
    });
    const fat = new Map(s.cells);
    for (let i = 0; i < 500; i++)
      fat.set(cellKey(R(0), `c${i}`), { input: { s: 'x'.repeat(9000) } });
    expect(
      v({ kind: 'cells', cells: [{ r: R(1), c: C(1), i: { n: 1 } }] }, { ...s, cells: fat }),
    ).toMatchObject({ error: 'sheet_full' });
    const sized = {
      ...s,
      layout: {
        ...s.layout,
        rowSize: Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`q${i}`, 30])),
      },
    };
    expect(v({ kind: 'cells', cells: [{ r: R(1), c: C(1), i: { n: 1 } }] }, sized)).toMatchObject({
      error: 'sheet_full',
    });
  });
});

describe('the look options', () => {
  it('takes flags and sizes in range, and refuses anything else', () => {
    const opt = (o: Record<string, unknown>) =>
      v({ kind: 'layout', changes: [{ k: 'options', ...o }] });
    expect(opt({ showGrid: false, showHeaders: true, colWidth: 150, rowHeight: null })).toEqual({
      ok: true,
    });
    for (const bad of [
      { showGrid: 'no' },
      { colWidth: 10 },
      { rowHeight: 2.5 },
      { colWidth: 5000 },
    ])
      expect(opt(bad)).toMatchObject({ error: 'write_invalid' });
  });
  it('holds a seeded layout to the same', () => {
    const s = base();
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, showGrid: false, colWidth: 140 } }),
    ).toEqual({ ok: true });
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, showGrid: true as never } }),
    ).toMatchObject({ error: 'write_invalid' });
    expect(validateSheetCreate({ ...s, layout: { ...s.layout, setupPending: true } })).toEqual({
      ok: true,
    });
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, setupPending: false as never } }),
    ).toMatchObject({ error: 'write_invalid' });
    expect(validateSheetCreate({ ...s, layout: { ...s.layout, rowHeight: 3 } })).toMatchObject({
      error: 'write_invalid',
    });
  });
});

describe('card tables', () => {
  const table = (over: Record<string, unknown> = {}) => ({
    id: 'tbl1',
    head: R(0),
    cols: [{ c: C(0), field: 'Title' }],
    rows: { [R(1)]: 'item-1' },
    type: 'task',
    ...over,
  });
  const set = (t: unknown, id = 'tbl1') =>
    v({ kind: 'layout', changes: [{ k: 'cardTable', id, table: t }] });
  it('takes a whole table or its removal, and refuses a malformed one', () => {
    expect(set(table())).toEqual({ ok: true });
    expect(set(table({ drafts: [R(2)] }))).toEqual({ ok: true });
    expect(set(table({ drafts: [R(2)], controls: C(2) }))).toEqual({ ok: true });
    expect(set(table({ controls: 'BAD' }))).toMatchObject({ error: 'write_invalid' });
    expect(set(table({ drafts: ['BAD'] }))).toMatchObject({ error: 'write_invalid' });
    expect(set(null)).toEqual({ ok: true });
    for (const bad of [
      table({ id: 'other' }),
      table({ head: 'NO' }),
      table({ cols: [] }),
      table({ cols: [{ c: C(0), field: '' }] }),
      table({ rows: { [R(1)]: '' } }),
      table({ rows: [] }),
      table({ type: '' }),
      table({ extra: 1 }),
      'x',
    ])
      expect(set(bad)).toMatchObject({ error: 'write_invalid' });
    expect(set(table(), 'BAD')).toMatchObject({ error: 'write_invalid' });
  });
  it('holds a seeded sheet to at most eight', () => {
    const s = base();
    const many = Array.from({ length: 9 }, (_, i) => table({ id: `tbl${i}x` }));
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, cardTables: many.slice(0, 8) as never } }),
    ).toEqual({ ok: true });
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, cardTables: many as never } }),
    ).toMatchObject({ error: 'write_invalid' });
  });
});

describe('validateSheetCreate', () => {
  it('checks the whole sheet', () => {
    const s = base();
    expect(validateSheetCreate(s)).toEqual({ ok: true });
    expect(validateSheetCreate({ ...s, id: 'x' })).toMatchObject({ error: 'write_invalid' });
    expect(validateSheetCreate({ ...s, title: '' })).toMatchObject({ error: 'title_invalid' });
    expect(validateSheetCreate({ ...s, layout: { rows: ['BAD'], cols: ['abcd'] } })).toMatchObject({
      error: 'axis_id_invalid',
    });
    expect(
      validateSheetCreate({ ...s, layout: { rows: ['abcd', 'abcd'], cols: ['abcd'] } }),
    ).toMatchObject({ error: 'axis_id_invalid' });
    expect(validateSheetCreate({ ...s, layout: { rows: [], cols: [] } })).toMatchObject({
      error: 'write_invalid',
    });
    const bad = new Map(s.cells);
    bad.set('k', { input: { x: 1 } as never });
    expect(validateSheetCreate({ ...s, cells: bad })).toMatchObject({ error: 'write_invalid' });
    const long = new Map([['k', { input: { s: 'x'.repeat(10_001) } }]]);
    expect(validateSheetCreate({ ...s, cells: long })).toMatchObject({ error: 'input_too_long' });
    const fmt = new Map([['k', { format: { b: false } as never }]]);
    expect(validateSheetCreate({ ...s, cells: fmt })).toMatchObject({ error: 'format_invalid' });
  });
  it('counts bytes and reads inputs', () => {
    expect(cellBytes({ input: { n: 1 }, format: { b: true } })).toBe(17);
    expect(cellBytes({})).toBe(0);
    expect(validInput(null)).toBe(false);
    expect(validInput([])).toBe(false);
    expect(validInput({ b: true })).toBe(true);
    expect(validInput({ q: 1 })).toBe(false);
    expect(validInput({ f: null })).toBe(false);
  });
});
