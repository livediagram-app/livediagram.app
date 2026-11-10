// A one-cell edit costs the cells it touches, not the sheet (blueprint sheets-engine.md "Performance and limits").
// On a 50,000-cell sheet, checking one typed value against the byte cap serialised every cell (12.5 ms, four times
// applying the write), and every drawn Sheet walked every formula's syntax tree on every store change to learn
// whether the tab reads Plan cards (2.5 ms each). Timed in CPU time (cpuMsOf), as ratios or budgets.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { Workbook } from './engine/workbook';
import { compileFormula } from './formula/stored';
import { cellKey, NOBODY, type Sheet } from './sheet';
import { applySheetWrite, type SheetWrite } from './store';
import { cellBytes, sheetBytes, validateWrite } from './validate';

const ROWS = 10_000;

function bigSheet(): Sheet {
  const layout = {
    rows: Array.from({ length: ROWS }, (_, i) => `row${i}`),
    cols: Array.from({ length: 5 }, (_, i) => `col${i}`),
  };
  const sheet: Sheet = {
    id: 'bigsheet',
    tabId: 'tab',
    title: 'Big',
    layout,
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: NOBODY,
  };
  const ctx = {
    own: { id: sheet.id, title: sheet.title, layout },
    byTitle: () => undefined,
    byId: () => undefined,
  };
  const f = (text: string) => {
    const r = compileFormula(text, ctx);
    if (!r.ok) throw new Error(text);
    return r.formula;
  };
  for (let r = 0; r < ROWS; r++) {
    const row = layout.rows[r]!;
    sheet.cells.set(cellKey(row, 'col0'), { input: { n: r } });
    sheet.cells.set(cellKey(row, 'col1'), { input: { s: `item ${r}` } });
    sheet.cells.set(cellKey(row, 'col2'), { input: { n: 1 } });
    sheet.cells.set(cellKey(row, 'col3'), {
      input: { f: f(`=VLOOKUP(A${r + 1},A$1:C$${ROWS},3,FALSE)`) },
    });
    sheet.cells.set(cellKey(row, 'col4'), { input: { f: f(`=SUM(C$1:C${r + 1})*D${r + 1}`) } });
  }
  return sheet;
}

describe('a one-cell edit on a 50,000-cell sheet', () => {
  it('checks the byte cap from cached cell sizes, at about the cost of applying the write', () => {
    const sheet = bigSheet();
    const write: SheetWrite = {
      kind: 'cells',
      cells: [{ r: 'row5000', c: 'col1', i: { s: 'hello' } }],
    };
    expect(validateWrite(sheet, write)).toEqual({ ok: true });
    // Timed in turns, best of seven each, so a collection or a busy core lands on both sides alike rather than on
    // whichever was timed second (it read 2.57 once under load, timed one after the other).
    let apply = Infinity;
    let check = Infinity;
    for (let i = 0; i < 7; i++) {
      apply = Math.min(
        apply,
        cpuMsOf(() => applySheetWrite(sheet, write, { now: 1, by: NOBODY })),
      );
      check = Math.min(
        check,
        cpuMsOf(() => validateWrite(sheet, write)),
      );
    }
    // The check applies the write once and reads every cell's size: about 1.3x applying it, where serialising
    // every cell made it 4x.
    expect(check / apply).toBeLessThan(cpuRatioCeiling(2.5));
  }, 30_000);

  it('counts a cell by what it stores, the same before and after the cache', () => {
    const cell = { input: { s: 'hello' }, format: { b: true as const } };
    const bytes = JSON.stringify(cell.input).length + JSON.stringify(cell.format).length;
    expect(cellBytes(cell)).toBe(bytes);
    expect(cellBytes(cell)).toBe(bytes);
    expect(cellBytes({})).toBe(0);
    const sheet = bigSheet();
    const next = applySheetWrite(
      sheet,
      { kind: 'cells', cells: [{ r: 'row1', c: 'col1', i: { s: 'a much longer value' } }] },
      { now: 1, by: NOBODY },
    ).sheet;
    expect(sheetBytes(next) - sheetBytes(sheet)).toBe(
      JSON.stringify({ s: 'a much longer value' }).length - JSON.stringify({ s: 'item 1' }).length,
    );
  }, 30_000);

  it('answers whether the tab reads Plan cards without walking its formulas', () => {
    const sheet = bigSheet();
    const wb = new Workbook({ sheets: [sheet], locale: 'en-GB' });
    expect(wb.usesCards()).toBe(false);
    // Asked by every drawn Sheet on every store change: a thousand asks fit in a few milliseconds, where a walk of
    // 20,000 formulas cost 2.5 ms each.
    expect(cpuMsOf(() => Array.from({ length: 1000 }, () => wb.usesCards()))).toBeLessThan(
      cpuBudgetMs(10),
    );
  }, 30_000);
});
