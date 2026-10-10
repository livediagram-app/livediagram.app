import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import { applySheetWrite, type SheetWrite } from './store';
import { clipFromRange, clipToHtml, clipToTsv, readPastedHtml, readPastedText } from './clipboard';
import { pasteClip, pasteCut, pasteExternal } from './commands-paste';
import { readRange, writeRows } from './a1-io';
import { findMatches, replaceAll } from './find';
import { columnValueCounts, conditionMatches, filteredOutRows } from './filter';
import { renderWindow } from './engine/render';
import { inputAsText, readTypedInput } from './typed-input';
import { cellKey } from './sheet';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
function apply(b: ReturnType<typeof book>, sheetId: string, w: SheetWrite) {
  const i = b.sheets.findIndex((s) => s.id === sheetId);
  const r = applySheetWrite(b.sheets[i]!, w, ctx);
  b.sheets[i] = r.sheet;
  b.wb.updateSheet(r.sheet, w.kind === 'cells' ? r.touched : undefined);
}
const seeded = () => {
  let s = 5;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

describe('copy and paste', () => {
  it('copies three ways and pastes its own cells with formulas shifted', () => {
    const b = book({ A1: '1', A2: '2', B1: '=A1*2', B2: 'x' });
    const id = b.sheets[0]!.id;
    apply(b, id, {
      kind: 'cells',
      cells: [
        {
          r: b.sheets[0]!.layout.rows[0]!,
          c: b.sheets[0]!.layout.cols[1]!,
          f: { b: true, fc: '#ff0000', ha: 'c', i: true, u: true, st: true, bg: '#00ff00', fs: 14 },
        },
      ],
    });
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 1 })!;
    expect(clip.values).toEqual([
      ['1', '2'],
      ['2', 'x'],
    ]);
    expect(
      clipToTsv([
        ['a', 'b\tc'],
        ['"', ''],
      ]),
    ).toBe('a\t"b\tc"\n""""\t');
    const html = clipToHtml(clip);
    expect(html).toContain(
      '<td style="font-weight:bold;font-style:italic;text-decoration:underline line-through;color:#ff0000;background-color:#00ff00;text-align:center;font-size:14pt">2</td>',
    );
    const p = pasteClip(b.wb, id, { r1: 4, c1: 0, r2: 4, c2: 0 }, clip, 'all', seeded())!;
    apply(b, id, p.edits[0]!.write);
    expect(b.v('B5')).toBe(2);
    expect(
      inputAsText(
        b.sheets[0]!.cells.get(cellKey(b.sheets[0]!.layout.rows[4]!, b.sheets[0]!.layout.cols[1]!))!
          .input,
        b.wb.ctxFor(id),
      ),
    ).toBe('=A5*2');
    const vals = pasteClip(b.wb, id, { r1: 8, c1: 0, r2: 8, c2: 0 }, clip, 'values')!;
    apply(b, id, vals.edits[0]!.write);
    expect(b.v('B9')).toBe(2);
    const fmts = pasteClip(b.wb, id, { r1: 8, c1: 3, r2: 8, c2: 3 }, clip, 'formats')!;
    apply(b, id, fmts.edits[0]!.write);
    expect(b.v('E9')).toBeNull();
    expect(clipFromRange(b.wb, 'nope', { r1: 0, c1: 0, r2: 0, c2: 0 })).toBeNull();
    expect(pasteClip(b.wb, 'nope', { r1: 0, c1: 0, r2: 0, c2: 0 }, clip, 'all')).toBeNull();
  });
  it('tiles to fill a selection that is a whole multiple, and grows the grid', () => {
    const b = book({ A1: '7' }, { rows: 3, cols: 2 });
    const id = b.sheets[0]!.id;
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 })!;
    const tiled = pasteClip(b.wb, id, { r1: 0, c1: 1, r2: 2, c2: 1 }, clip, 'all')!;
    apply(b, id, tiled.edits[0]!.write);
    expect([b.v('B1'), b.v('B3')]).toEqual([7, 7]);
    const big = pasteExternal(
      b.wb,
      id,
      { r1: 2, c1: 1, r2: 2, c2: 1 },
      [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
      'all',
      seeded(),
    )!;
    apply(b, id, big.edits[0]!.write);
    expect(b.sheets[0]!.layout.rows).toHaveLength(4);
    expect(b.sheets[0]!.layout.cols).toHaveLength(4);
    expect(b.v('D4')).toBe(6);
    expect(big.truncated).toBe(false);
  });
  it('moves cut cells, and formulas follow them', () => {
    const b = book({
      'Sheet 1': { A1: '5', A2: '=A1*2', C1: '=SUM(A1:A2)' },
      Other: { A1: "='Sheet 1'!A1" },
    });
    const id = b.sheets[0]!.id;
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 0 }, true)!;
    const p = pasteCut(b.wb, id, { r: 4, c: 1 }, clip)!;
    for (const e of p.edits) apply(b, e.sheetId, e.write);
    expect([b.v('A1'), b.v('B5'), b.v('B6'), b.v('C1')]).toEqual([null, 5, 10, 15]);
    expect(b.v('A1', 'Other')).toBe(5);
    const other = b.sheets[1]!;
    const text = inputAsText(
      other.cells.get(cellKey(other.layout.rows[0]!, other.layout.cols[0]!))!.input,
      b.wb.ctxFor(other.id),
    );
    expect(text).toBe("='Sheet 1'!B5");
    // Cut to another sheet.
    const clip2 = clipFromRange(b.wb, id, { r1: 4, c1: 1, r2: 4, c2: 1 }, true)!;
    const p2 = pasteCut(b.wb, other.id, { r: 3, c: 3 }, clip2)!;
    for (const e of p2.edits) apply(b, e.sheetId, e.write);
    expect(b.v('D4', 'Other')).toBe(5);
    expect(b.v('B6')).toBe(10);
    expect(pasteCut(b.wb, 'nope', { r: 0, c: 0 }, clip2)).toBeNull();
  });
  it('pastes overlapping cut moves without losing cells', () => {
    const b = book({ A1: '1', A2: '2' });
    const id = b.sheets[0]!.id;
    const clip = clipFromRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 0 }, true)!;
    for (const e of pasteCut(b.wb, id, { r: 1, c: 0 }, clip)!.edits) apply(b, id, e.write);
    expect([b.v('A1'), b.v('A2'), b.v('A3')]).toEqual([null, 1, 2]);
  });
  it('reads pasted HTML tables', () => {
    const rows = readPastedHtml(
      '<html><body><table><tr><th style="font-weight:700">Name</th><td colspan="2"><b>Wide</b></td></tr>' +
        '<tr><td rowspan="2" style="color: rgb(255, 0, 0); background-color:#ffffff">Tall</td><td>a&amp;b</td><td><span style="text-decoration: underline">u</span></td></tr>' +
        '<tr><td style="text-align:right;font-style:italic">x<br>y</td><td style="background:#abc">&#9733; &#x41; &nbsp;q &bogus;</td></tr></table></body></html>',
    )!;
    expect(rows.map((r) => r.map((c) => c.text))).toEqual([
      ['Name', 'Wide', ''],
      ['Tall', 'a&b', 'u'],
      ['', 'x\ny', '★ A  q &bogus;'],
    ]);
    expect(rows[0]![0]!.format).toEqual({ b: true });
    expect(rows[0]![1]!.format).toEqual({ b: true });
    expect(rows[1]![0]!.format).toEqual({ fc: '#ff0000' });
    expect(rows[1]![2]!.format).toEqual({ u: true });
    expect(rows[2]![1]!.format).toEqual({ ha: 'r', i: true });
    expect(rows[2]![2]!.format).toEqual({ bg: '#aabbcc' });
    expect(readPastedHtml('<p>no table</p>')).toBeNull();
    expect(readPastedHtml('<table></table>')).toBeNull();
    expect(
      readPastedHtml(
        '<table><td><i>i</i><s>s</s><u>u</u></td><td style="color:blue;text-align:left;text-decoration-line:line-through">c</td><td style="text-align:center;color:black">c</td></table>',
      )![0]!.map((c) => c.format),
    ).toEqual([{ i: true, u: true, st: true }, { fc: '#0000ff', ha: 'l', st: true }, { ha: 'c' }]);
  });
  it('reads pasted text', () => {
    expect(readPastedText('a\tb\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(readPastedText('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(readPastedText('one\ntwo, three')).toEqual([['one'], ['two, three']]);
    expect(readPastedText('')).toEqual([['']]);
  });
  it('pastes external rows read as typed, with formats', () => {
    const b = book({});
    const id = b.sheets[0]!.id;
    const p = pasteExternal(
      b.wb,
      id,
      { r1: 0, c1: 0, r2: 0, c2: 0 },
      [[{ text: '12%', format: { b: true } }, { text: '=1+' }, { text: '' }], ['hi']],
      'all',
    )!;
    apply(b, id, p.edits[0]!.write);
    expect([b.v('A1'), b.v('B1'), b.v('A2')]).toEqual([0.12, '=1+', 'hi']);
    const f = pasteExternal(
      b.wb,
      id,
      { r1: 0, c1: 0, r2: 0, c2: 0 },
      [[{ text: 'z', format: { i: true } }]],
      'formats',
    )!;
    apply(b, id, f.edits[0]!.write);
    expect(b.v('A1')).toBe(0.12);
    const v = pasteExternal(
      b.wb,
      id,
      { r1: 0, c1: 0, r2: 0, c2: 0 },
      [[{ text: 'x', format: { i: true } }]],
      'values',
    )!;
    apply(b, id, v.edits[0]!.write);
    expect(b.v('A1')).toBe('x');
    expect(pasteExternal(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 }, [], 'all')).toBeNull();
  });
});

describe('agents', () => {
  it('reads ranges with inputs, values and what they show', () => {
    const b = book({ A1: '1', B1: '=A1*2', A2: '12%', B2: '=1/0' });
    const id = b.sheets[0]!.id;
    const r = readRange(b.wb, id);
    expect(r).toMatchObject({ ok: true, range: 'A1:B2', truncated: false });
    if (r.ok) {
      expect(r.rows[0]![1]).toEqual({ input: '=A1*2', value: 2, display: '2' });
      expect(r.rows[1]![0]).toEqual({ input: '0.12', value: 0.12, display: '12.00%' });
      expect(r.rows[1]![1]!.value).toBe('#DIV/0!');
    }
    expect(readRange(b.wb, id, 'A1')).toMatchObject({ ok: true, range: 'A1' });
    expect(readRange(b.wb, id, 'nonsense')).toEqual({ ok: false, error: 'range_invalid' });
    expect(readRange(b.wb, 'nope')).toEqual({ ok: false, error: 'sheet_not_found' });
    const wide = readRange(b.wb, id, 'A1:L30');
    expect(wide.ok && wide.truncated).toBe(false);
  });
  it('caps a read', () => {
    const b = book({}, { rows: 10_000, cols: 2 });
    const r = readRange(b.wb, b.sheets[0]!.id, 'A1:B10000');
    expect(r.ok && r.truncated).toBe(true);
    expect(r.ok && r.rows.length).toBe(2500);
  });
  it('writes rows from a cell, growing the grid', () => {
    const b = book({}, { rows: 2, cols: 2 });
    const id = b.sheets[0]!.id;
    const w = writeRows(
      b.wb,
      id,
      'B2',
      [
        ['Total', '=SUM(1,2)', 3, true, null],
        ['8/10/2026', '£5'],
      ],
      seeded(),
    );
    expect(w).toMatchObject({ ok: true, range: 'B2:F3' });
    if (w.ok) apply(b, id, w.write);
    expect([b.v('C2'), b.v('D2'), b.v('E2'), b.v('B3')]).toEqual([3, 3, true, 46303]);
    expect(writeRows(b.wb, id, 'A1', [['=(']])).toMatchObject({
      ok: false,
      error: 'formula_invalid',
      at: 'A1',
    });
    expect(writeRows(b.wb, id, 'A1', [['x'.repeat(10_001)]])).toMatchObject({
      ok: false,
      why: 'The value is too long',
    });
    expect(writeRows(b.wb, id, '??', [])).toEqual({ ok: false, error: 'range_invalid' });
    expect(writeRows(b.wb, 'nope', 'A1', [])).toEqual({ ok: false, error: 'sheet_not_found' });
    const nan = writeRows(b.wb, id, 'A1', [[Infinity]]);
    expect(nan.ok && nan.write.kind).toBe('cells');
  });
});

describe('find, filter and render', () => {
  it('finds values and formulas, and replaces all', () => {
    const b = book({ A1: 'Apple pie', A2: 'apple', B1: '=CONCAT("app", "le")', B2: '42' });
    const id = b.sheets[0]!.id;
    expect(findMatches(b.wb, id, 'apple')).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ]);
    expect(findMatches(b.wb, id, 'apple', { matchCase: true })).toEqual([
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ]);
    expect(findMatches(b.wb, id, 'apple', { entireCell: true })).toEqual([
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ]);
    expect(findMatches(b.wb, id, 'CONCAT', { inFormulas: true })).toEqual([{ r: 0, c: 1 }]);
    expect(findMatches(b.wb, id, '')).toEqual([]);
    const r = replaceAll(b.wb, id, 'apple', 'pear');
    expect(r.count).toBe(2);
    apply(b, id, { kind: 'cells', cells: r.cells });
    expect([b.v('A1'), b.v('A2'), b.v('B1')]).toEqual(['pear pie', 'pear', 'apple']);
    const f = replaceAll(b.wb, id, '"app"', '"gr"', { inFormulas: true });
    apply(b, id, { kind: 'cells', cells: f.cells });
    expect(b.v('B1')).toBe('grle');
    expect(replaceAll(b.wb, id, '42', '', { entireCell: true }).cells[0]!.i).toBeNull();
    expect(replaceAll(b.wb, id, 'x', 'y').count).toBe(0);
    expect(replaceAll(b.wb, id, '', 'y').count).toBe(0);
    expect(replaceAll(b.wb, 'nope', 'x', 'y').count).toBe(0);
    expect(replaceAll(b.wb, id, 'CONCAT', 'CONCAT(', { inFormulas: true }).count).toBe(0);
  });
  it('filters rows by values and conditions', () => {
    const b = book({
      A1: 'Name',
      B1: 'Score',
      A2: 'a',
      B2: '5',
      A3: 'b',
      B3: '9',
      A4: 'c',
      B4: '',
    });
    const s = b.sheets[0]!;
    const [r, c] = [s.layout.rows, s.layout.cols];
    apply(b, s.id, {
      kind: 'layout',
      changes: [
        {
          k: 'filter',
          filter: {
            r1: r[0]!,
            c1: c[0]!,
            r2: r[3]!,
            c2: c[1]!,
            conds: { [c[1]!]: { op: 'gt', a: '6' } },
          },
        },
      ],
    });
    expect([...filteredOutRows(b.wb, s.id)]).toEqual([r[1], r[3]]);
    expect(columnValueCounts(b.wb, s.id, c[0]!)).toEqual([
      { text: 'a', count: 1 },
      { text: 'b', count: 1 },
      { text: 'c', count: 1 },
    ]);
    expect(columnValueCounts(b.wb, s.id, c[1]!)).toEqual([
      { text: '5', count: 1 },
      { text: '9', count: 1 },
      { text: '', count: 1 },
    ]);
    expect(columnValueCounts(b.wb, s.id, 'gone')).toEqual([]);
    expect(columnValueCounts(b.wb, 'nope', c[0]!)).toEqual([]);
    expect([...filteredOutRows(b.wb, 'nope')]).toEqual([]);
    apply(b, s.id, { kind: 'layout', changes: [{ k: 'filterCond', col: c[1]!, cond: null }] });
    expect(filteredOutRows(b.wb, s.id).size).toBe(0);
    // A malformed condition stored before writes were checked filters nothing, never throwing.
    apply(b, s.id, {
      kind: 'layout',
      changes: [{ k: 'filterCond', col: c[0]!, cond: { values: 5, a: 7 } as never }],
    });
    expect(filteredOutRows(b.wb, s.id).size).toBe(0);
  });
  it.each([
    [{ values: ['a'] }, 'a', 'a', true],
    [{ values: ['a'] }, 'b', 'b', false],
    [{ op: 'empty' }, null, '', true],
    [{ op: 'notEmpty' }, null, '', false],
    [{ op: 'contains', a: 'PP' }, 'apple', 'apple', true],
    [{ op: 'notContains', a: 'x' }, 'apple', 'apple', true],
    [{ op: 'startsWith', a: 'ap' }, 'apple', 'apple', true],
    [{ op: 'endsWith', a: 'le' }, 'apple', 'apple', true],
    [{ op: 'exactly', a: 'Apple' }, 'apple', 'apple', true],
    [{ op: 'dateBefore', a: '2026-10-08' }, 46302, '', true],
    [{ op: 'dateAfter', a: '2026-10-08' }, 46304.5, '', true],
    [{ op: 'dateOn', a: '2026-10-08' }, 46303.9, '', true],
    [{ op: 'gt', a: '3' }, 4, '4', true],
    [{ op: 'gte', a: '4' }, 4, '4', true],
    [{ op: 'lt', a: '3' }, 4, '4', false],
    [{ op: 'lte', a: '4' }, 4, '4', true],
    [{ op: 'between', a: '5', b: '1' }, 4, '4', true],
    [{ op: 'eq', a: '4' }, 4, '4', true],
    [{ op: 'eq', a: 'x' }, 'X', 'x', true],
    [{ op: 'neq', a: '4' }, 4, '4', false],
    [{ op: 'neq', a: 'y' }, 'x', 'x', true],
    [{ op: 'gt', a: 'x' }, 4, '4', false],
    [{}, 'x', 'x', true],
  ])('condition %j on %j', (cond, v, shown, ok) => {
    expect(conditionMatches(cond as never, v as never, shown as string, 'en-GB')).toBe(ok);
  });
  it("carries the sheet's look into the model", () => {
    const b = book({ A1: '1' });
    const s = b.sheets[0]!;
    expect(renderWindow(b.wb, s.id, { width: 200, height: 60 }, 'en-GB')!.hideGrid).toBeUndefined();
    apply(b, s.id, {
      kind: 'layout',
      changes: [{ k: 'options', showGrid: false, showHeaders: false }],
    });
    const m = renderWindow(b.wb, s.id, { width: 200, height: 60 }, 'en-GB')!;
    expect([m.hideGrid, m.hideHeaders]).toEqual([true, true]);
  });
  it('renders the top-left window with formats and merges', () => {
    const b = book({ A1: 'Title', B2: '=1/0', C3: '3' });
    const s = b.sheets[0]!;
    const [r, c] = [s.layout.rows, s.layout.cols];
    apply(b, s.id, {
      kind: 'layout',
      changes: [
        { k: 'merge', range: { r1: r[0]!, c1: c[0]!, r2: r[0]!, c2: c[1]! } },
        { k: 'hide', axis: 'r', ids: [r[1]!], hidden: true },
        { k: 'freeze', rows: 1 },
      ],
      cells: [
        {
          r: r[0]!,
          c: c[0]!,
          f: {
            b: true,
            i: true,
            u: true,
            st: true,
            fc: '#111111',
            bg: '#eeeeee',
            fs: 18,
            wr: 'w',
            ha: 'c',
            va: 'm',
            bt: { w: 1, s: 'solid', c: '#000000' },
            br: { w: 1, s: 'solid', c: '#000000' },
            bb: { w: 1, s: 'solid', c: '#000000' },
            bl: { w: 1, s: 'solid', c: '#000000' },
          },
        },
      ],
    });
    const m = renderWindow(b.wb, s.id, { width: 250, height: 60 }, 'en')!;
    expect(m.colLabels).toEqual(['A', 'B', 'C']);
    expect(m.rowLabels).toEqual(['1', '3', '4']);
    expect(m.frozenRows).toBe(1);
    expect(m.cells[0]).toMatchObject({
      text: 'Title',
      colSpan: 2,
      rowSpan: 1,
      bold: true,
      fill: '#eeeeee',
      align: 'c',
      valign: 'm',
    });
    expect(m.cells.find((x) => x.text === '3')).toMatchObject({ r: 1, c: 2, align: 'r' });
    expect(renderWindow(b.wb, 'nope', { width: 1, height: 1 }, 'en')).toBeUndefined();
    const errs = renderWindow(
      book({ A1: '=1/0' }).wb,
      'sheet0xx',
      { width: 100, height: 30 },
      'en',
    )!;
    expect(errs.cells[0]!.error).toBe(true);
  });
  it('reads typed inputs and shows them back', () => {
    const b = book({ A1: "'012" });
    const ctxOf = b.wb.ctxFor(b.sheets[0]!.id);
    expect(readTypedInput('x'.repeat(10_001), 'en', ctxOf)).toMatchObject({
      kind: 'invalid',
      reason: 'input_too_long',
    });
    expect(readTypedInput(`=${'1+'.repeat(4001)}`, 'en', ctxOf)).toMatchObject({
      kind: 'invalid',
      reason: 'too_long',
    });
    expect(readTypedInput('=1', 'en', ctxOf, true)).toEqual({ kind: 'value', input: { s: '=1' } });
    expect(inputAsText(undefined, ctxOf)).toBe('');
    expect(inputAsText({ b: true }, ctxOf)).toBe('TRUE');
    expect(inputAsText({ n: 0.1 + 0.2 }, ctxOf)).toBe('0.3');
    expect(inputAsText({ s: 'x' }, ctxOf)).toBe('x');
  });
});

describe('render models for a tab', () => {
  it('builds one model per framed sheet', async () => {
    const { renderModelsForTab, sheetFramesOf } = await import('./engine/render');
    const { sheetToJson } = await import('./sheet-json');
    const b = book({ A1: '=1+1' });
    const json = b.sheets.map(sheetToJson);
    const frames = sheetFramesOf([
      {
        type: 'shape',
        shape: 'plan-sheet',
        width: 300,
        height: 200,
        planSheet: { sheetId: b.sheets[0]!.id },
      },
      { type: 'shape', shape: 'plan-sheet', planSheet: { sheetId: b.sheets[0]!.id } },
      { type: 'shape', shape: 'rect' },
    ]);
    expect(frames).toHaveLength(2);
    const models = renderModelsForTab(json, frames, { now: () => 1 });
    expect(models.get(b.sheets[0]!.id)!.cells[0]!.text).toBe('2');
    expect(renderModelsForTab([], frames).size).toBe(0);
    expect(renderModelsForTab(json, [{ sheetId: 'nope0000', width: 10, height: 10 }]).size).toBe(0);
  });
});
