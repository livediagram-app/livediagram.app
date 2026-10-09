// Performance budgets (blueprint sheets-engine.md "Performance and limits"), measured on the worst case the limits
// allow: 50,000 filled cells, 20,000 of them formulas. CI machines are slower and shared, so the asserted budget
// is a multiple of the laptop target.
import { describe, expect, it } from 'vitest';
import { Workbook } from './workbook';
import { cellKey, type Sheet } from '../sheet';
import { compileFormula } from '../formula/stored';

const CI_FACTOR = 4;

function bigSheet(): Sheet {
  const rows = 10_000;
  const cols = 5;
  const layout = {
    rows: Array.from({ length: rows }, (_, i) => `r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `c${i}`),
  };
  const sheet: Sheet = {
    id: 'bigsheet',
    tabId: 't',
    title: 'Big',
    layout,
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: '', name: '', color: '#000000' },
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
  for (let r = 0; r < rows; r++) {
    // A, B, C: numbers (30,000 cells). D: a running SUM of a 10-cell window. E: a reference chain.
    sheet.cells.set(cellKey(layout.rows[r]!, 'c0'), { input: { n: r } });
    sheet.cells.set(cellKey(layout.rows[r]!, 'c1'), { input: { n: r * 2 } });
    sheet.cells.set(cellKey(layout.rows[r]!, 'c2'), { input: { n: 1 } });
    const lo = Math.max(1, r - 8);
    sheet.cells.set(cellKey(layout.rows[r]!, 'c3'), { input: { f: f(`=SUM(A${lo}:B${r + 1})`) } });
    sheet.cells.set(cellKey(layout.rows[r]!, 'c4'), {
      input: { f: f(r === 0 ? '=C1' : `=E${r}+C${r + 1}`) },
    });
  }
  return sheet;
}

describe('performance', () => {
  it('works out every cell of a 50,000-cell sheet, then a one-cell change, within budget', () => {
    const sheet = bigSheet();
    expect(sheet.cells.size).toBe(50_000);
    let t = performance.now();
    const wb = new Workbook({ sheets: [sheet], locale: 'en' });
    for (let r = 0; r < 10_000; r++) for (let c = 0; c < 5; c++) wb.value(sheet.id, r, c);
    const full = performance.now() - t;
    expect(wb.value(sheet.id, 9_999, 4)).toBe(10_000);

    // Change C5000: half the chain (5,000 cells) depends on it.
    const key = cellKey('r4999', 'c2');
    const cells = new Map(sheet.cells);
    cells.set(key, { input: { n: 2 } });
    const next = { ...sheet, cells };
    t = performance.now();
    wb.updateSheet(next, [key]);
    expect(wb.value(sheet.id, 9_999, 4)).toBe(10_001);
    const change = performance.now() - t;

    // A change nothing reads.
    const lone = cellKey('r100', 'c1');
    const cells2 = new Map(next.cells);
    cells2.set(lone, { input: { n: 7 } });
    t = performance.now();
    wb.updateSheet({ ...next, cells: cells2 }, [lone]);
    wb.value(sheet.id, 100, 3);
    const small = performance.now() - t;

    console.info(
      `[sheets perf] full ${full.toFixed(0)} ms, chain change ${change.toFixed(1)} ms, local change ${small.toFixed(2)} ms`,
    );
    expect(full).toBeLessThan(400 * CI_FACTOR);
    expect(change).toBeLessThan(100 * CI_FACTOR);
    expect(small).toBeLessThan(5 * CI_FACTOR);
  });
});
