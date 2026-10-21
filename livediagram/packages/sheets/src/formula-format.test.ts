import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { typeInto } from './commands';
import { pasteExternal } from './commands-paste';
import { writeRows } from './a1-io';
import { readTypedInput } from './typed-input';
import { cellKey } from './sheet';
import type { SheetWrite } from './store';

// docs/specs/029-sheets/formulas.md "What a typed input becomes": a formula takes the format of what its outermost
// function returns, and only in a cell whose own format is Automatic. `=TODAY()` drew as 46314.

const hintOf = (text: string) => {
  const b = book({});
  const read = readTypedInput(text, 'en-GB', b.wb.ctxFor(b.sheets[0]!.id));
  return read.kind === 'value' ? read.hint : undefined;
};

/** The format a write gives A1. */
const formatOf = (w: SheetWrite | undefined) =>
  w && 'cells' in w ? (w.cells as { f?: unknown }[])[0]?.f : undefined;

describe('a formula’s format', () => {
  it.each([
    ['=TODAY()', 'date'],
    ['=today()', 'date'],
    ['=DATE(2026,10,30)', 'date'],
    ['=DATEVALUE("30 Oct 2026")', 'date'],
    ['=EDATE(A1, 1)', 'date'],
    ['=EOMONTH(A1, 0)', 'date'],
    ['=WORKDAY(A1, 3)', 'date'],
    ['=NOW()', 'datetime'],
    ['=TIME(9,30,0)', 'time'],
    ['=TIMEVALUE("9:30")', 'time'],
    ['=TODAY()+7', 'date'],
    ['=7+TODAY()', 'date'],
    ['=TODAY()-1', 'date'],
  ])('%s is %s', (text, nf) => {
    expect(hintOf(text)).toEqual({ nf, ifAutomatic: true });
  });

  it.each([
    '=YEAR(TODAY())',
    '=A1',
    '=A1-TODAY()',
    '=TODAY()-A1',
    '=1-TODAY()',
    '=SUM(A1:A3)',
    '=1/2',
  ])('%s stays Automatic', (text) => {
    expect(hintOf(text)).toBeUndefined();
  });

  it('formats a typed =TODAY() as a date in an Automatic cell, and leaves a formatted one alone', () => {
    const b = book({});
    const id = b.sheets[0]!.id;
    const typed = typeInto(b.wb, id, { r: 0, c: 0 }, '=TODAY()');
    expect(typed?.ok && formatOf(typed.write)).toEqual({ nf: 'date' });

    const s = b.sheets[0]!;
    s.cells.set(cellKey(s.layout.rows[0]!, s.layout.cols[0]!), {
      input: { n: 1 },
      format: { nf: 'number' },
    });
    b.wb.updateSheet(s);
    const retyped = typeInto(b.wb, id, { r: 0, c: 0 }, '=TODAY()');
    expect(retyped?.ok && formatOf(retyped.write)).toBeUndefined();
  });

  it('keeps a pasted cell’s own format over its formula’s', () => {
    const b = book({});
    const id = b.sheets[0]!.id;
    const at = { r1: 0, c1: 0, r2: 0, c2: 0 };
    const own = pasteExternal(
      b.wb,
      id,
      at,
      [[{ text: '=TODAY()', format: { nf: 'number' } }]],
      'all',
    )!;
    expect(formatOf(own.edits[0]!.write)).toEqual({ nf: 'number' });
    const bare = pasteExternal(b.wb, id, at, [[{ text: '=TODAY()' }]], 'all')!;
    expect(formatOf(bare.edits[0]!.write)).toEqual({ nf: 'date' });
  });

  it('gives an agent’s =TODAY() a date only where the cell is Automatic', () => {
    const b = book({ B1: '5' });
    const id = b.sheets[0]!.id;
    const s = b.sheets[0]!;
    s.cells.set(cellKey(s.layout.rows[0]!, s.layout.cols[1]!), {
      input: { n: 5 },
      format: { nf: 'number' },
    });
    b.wb.updateSheet(s);
    const w = writeRows(b.wb, id, 'A1', [['=TODAY()', '=TODAY()']]);
    expect(w.ok).toBe(true);
    const cells = w.ok ? ((w.write as { cells: { f?: unknown }[] }).cells ?? []) : [];
    expect(cells.map((c) => c.f)).toEqual([{ nf: 'date' }, undefined]);
  });
});
