// A sheet an agent lays out as a template is (docs/specs/029-sheets/sheet-store.md "A design"): compiled by the
// templates' own step, blocks stacked where the answer says, widths fitted, rules and charts made.
import { describe, expect, it } from 'vitest';
import {
  NOBODY,
  Workbook,
  applySheetWrite,
  cellKey,
  emptyLayout,
  posRangeOf,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { buildDesign, type SheetDesignInput } from './sheet-design';
import { buildSheetChange } from './sheet-change-build';

let n = 1;
const rand = () => ((n = (n * 16807) % 2147483647), n / 2147483647);

function blankBook(cols = 12) {
  n = 5;
  const sheet: Sheet = {
    id: 'sheet_design',
    tabId: 'tab',
    title: 'Budget',
    layout: emptyLayout(rand, 30, cols),
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: NOBODY,
  };
  return { sheet, wb: new Workbook({ sheets: [sheet], locale: 'en-GB' }) };
}

function laid(wb: Workbook, sheet: Sheet, writes: readonly SheetWrite[]): Sheet {
  let s = sheet;
  for (const w of writes) s = applySheetWrite(s, w, { now: 0, by: NOBODY }).sheet;
  wb.updateSheet(s);
  return s;
}

const BUDGET: SheetDesignInput = {
  heading: 'Household Budget',
  subtitle: 'Type over the figures.',
  accent: 'emerald',
  blocks: [
    {
      kind: 'table',
      head: ['Category', 'Planned', 'Actual', 'Difference', 'Status', 'Paid'],
      rows: [
        ['Rent', 1200, 1200, '=B5-C5', 'On track', true],
        ['Food', 400, 450, '=B6-C6', 'Over', false],
      ],
      total: ['Total', '=SUM(B5:B6)', '=SUM(C5:C6)', '=SUM(D5:D6)', null, null],
      formats: {
        Planned: 'currency',
        Actual: 'currency',
        Difference: { numberFormat: 'currency', decimals: 0 },
      },
      inputs: ['Actual'],
      dropdowns: { Status: { options: ['On track', 'Over'], colors: ['#bbf7d0', '#fecaca'] } },
      checkboxes: ['Paid'],
      chart: { type: 'column', columns: ['Category', 'Actual'] },
    },
    {
      kind: 'fields',
      heading: 'Summary',
      items: [
        { label: 'Left over', value: '=B7-C7', kind: 'result', format: 'currency' },
        { label: 'Savings goal', value: 300, kind: 'input' },
      ],
    },
    { kind: 'note', text: 'Figures in pounds.' },
  ],
};

describe('a design', () => {
  it('lays out the heading, stacked blocks and their formats, saying where each landed', () => {
    const { wb, sheet } = blankBook();
    const built = buildDesign(wb, sheet.id, BUDGET, { dark: false }, rand);
    if (!built.ok) throw new Error(built.message);
    expect(built.line).toBe(
      'laid out "Household Budget" in banded, emerald: table "Category…" header A4:F4, rows A5:F6, total A7:F7; ' +
        'fields A10:B11 (values in B); note A13; a chart',
    );
    const s = laid(wb, sheet, built.writes);
    const cell = (r: number, c: number) =>
      s.cells.get(cellKey(s.layout.rows[r]!, s.layout.cols[c]!));
    expect(wb.value(sheet.id, 0, 0)).toBe('Household Budget');
    expect(cell(0, 0)?.format).toMatchObject({ b: true, fs: 18 });
    expect(cell(3, 0)?.format).toMatchObject({ b: true, fc: '#ffffff' });
    expect(cell(4, 1)?.format).toMatchObject({ nf: 'currency' });
    expect(cell(4, 3)?.format).toMatchObject({ nf: 'currency', dp: 0 });
    // The input column is tinted, the total ruled and bold.
    expect(cell(4, 2)?.format?.bg).toBe('#fefce8');
    expect(cell(6, 1)?.format).toMatchObject({ b: true });
    expect(wb.value(sheet.id, 6, 1)).toBe(1600);
    expect(wb.value(sheet.id, 9, 0)).toBe('Left over');
    expect(wb.value(sheet.id, 9, 1)).toBe(-50);
    expect(wb.value(sheet.id, 12, 0)).toBe('Figures in pounds.');
    // The heading spans the design, the header is frozen, the columns fitted.
    expect(posRangeOf(s.layout, s.layout.merges![0]!)).toEqual({ r1: 0, c1: 0, r2: 0, c2: 5 });
    expect(s.layout.frozenRows).toBe(4);
    expect(s.layout.colSize?.[s.layout.cols[0]!]).toBeGreaterThan(56);
    // The dropdown column leaves its chips room: "On track" and a chip's padding and arrow.
    expect(s.layout.colSize?.[s.layout.cols[4]!]).toBe(Math.round(8 * (40 / 3) * 0.56 + 18 + 48));
    // A dropdown over the Status body, a checkbox over Paid.
    const rules = (s.layout.rules ?? []).map((r) => [r.is, posRangeOf(s.layout, r)]);
    expect(rules).toEqual([
      ['list', { r1: 4, c1: 4, r2: 5, c2: 4 }],
      ['check', { r1: 4, c1: 5, r2: 5, c2: 5 }],
    ]);
    // The chart reads the header and body, only Category and Actual, right of the table a column clear.
    expect(built.charts).toHaveLength(1);
    const [chart] = built.charts;
    expect(chart).toMatchObject({ type: 'column', width: 420, height: 280, palette: 'forest' });
    expect(posRangeOf(s.layout, chart!.range)).toEqual({ r1: 3, c1: 0, r2: 5, c2: 5 });
    expect(chart!.cols).toEqual([s.layout.cols[0], s.layout.cols[2]]);
    expect(chart!.anchor.y).toBe(46 + 24 + 18);
  });

  it('places blocks at their cells, in a look, accent and widths given, tinted for a dark canvas', () => {
    const { wb, sheet } = blankBook();
    const built = buildDesign(
      wb,
      sheet.id,
      {
        heading: 'Loan',
        look: 'boxed',
        accent: 'violet',
        widths: [150, 90],
        freeze: 0,
        blocks: [
          { kind: 'fields', at: 'A4', items: [{ label: 'Amount', value: 250000, kind: 'input' }] },
          {
            kind: 'table',
            at: 'D4',
            head: ['Month', 'Payment'],
            rows: [[1, 100]],
            chart: { type: 'line', at: 'H4', width: 10, height: 9999 },
          },
          { kind: 'note', text: 'Under the deeper block.' },
        ],
      },
      { dark: true },
      rand,
    );
    if (!built.ok) throw new Error(built.message);
    expect(built.line).toContain('note A7');
    const s = laid(wb, sheet, built.writes);
    expect(s.layout.frozenRows ?? 0).toBe(0);
    expect(s.layout.colSize?.[s.layout.cols[0]!]).toBe(150);
    expect(s.cells.get(cellKey(s.layout.rows[3]!, s.layout.cols[3]!))?.format?.bt).toBeDefined();
    // Sized within bounds.
    expect(built.charts[0]).toMatchObject({
      type: 'line',
      width: 160,
      height: 2000,
      palette: 'berry',
    });
  });

  it('freezes nothing by default when its first table sits low', () => {
    const { wb, sheet } = blankBook();
    const built = buildDesign(
      wb,
      sheet.id,
      { heading: 'Low', blocks: [{ kind: 'table', at: 'A12', head: ['A'], rows: [] }] },
      { dark: false },
      rand,
    );
    if (!built.ok) throw new Error(built.message);
    expect(laid(wb, sheet, built.writes).layout.frozenRows ?? 0).toBe(0);
  });

  it('refuses what it cannot lay out, in words', () => {
    const refusal = (design: SheetDesignInput, cols?: number) => {
      const { wb, sheet } = blankBook(cols);
      const built = buildDesign(wb, sheet.id, design, { dark: false }, rand);
      return built.ok ? null : `${built.code}: ${built.message}`;
    };
    const table = (extra: object) => ({
      heading: 'H',
      blocks: [{ kind: 'table' as const, head: ['Name', 'Amount'], rows: [['a', 1]], ...extra }],
    });
    expect(refusal(table({ formats: { Price: 'currency' } }))).toBe(
      'write_invalid: Table 1 has no column "Price". Its columns: Name, Amount.',
    );
    expect(refusal(table({ formats: { Amount: 'money' } }))).toMatch(
      /^format_invalid: Column "Amount"'s format/,
    );
    expect(refusal(table({ at: 'A2' }))).toMatch(/^range_invalid: Block 1 starts on row 4/);
    expect(refusal(table({ at: 'nope' }))).toMatch(/^range_invalid: Block 1's at "nope"/);
    expect(refusal(table({ rows: [['a', '=SUM(']] }))).toMatch(
      /^formula_invalid: The formula in B5 cannot be read/,
    );
    expect(refusal(table({ chart: { type: 'pie', at: '??' } }))).toMatch(
      /^range_invalid: A chart's at/,
    );
    expect(refusal({ heading: 'H', blocks: [{ kind: 'table', head: [], rows: [] }] })).toBe(
      'write_invalid: Table 1 has no header.',
    );
    expect(
      refusal({ heading: 'H', accent: 'gold' as never, blocks: [{ kind: 'note', text: 'x' }] }),
    ).toMatch(/^write_invalid: Accents:/);
    expect(
      refusal({
        heading: 'H',
        blocks: [{ kind: 'fields', items: [{ label: 'x', value: 1, format: 'nope' }] }],
      }),
    ).toBe(`format_invalid: "x"'s format is not one a cell takes.`);
    expect(refusal(table({}), 1)).toBe(
      'sheet_too_large: The design is 2 columns wide; the sheet has 1.',
    );
    expect(refusal(table({ dropdowns: { Name: { options: [' '] } } }))).toMatch(/^rule_invalid/);
    const { wb, sheet } = blankBook();
    laid(wb, sheet, [
      {
        kind: 'cells',
        cells: [{ r: sheet.layout.rows[0]!, c: sheet.layout.cols[0]!, i: { n: 1 } }],
      },
    ]);
    const busy = buildSheetChange(wb, sheet.id, { op: 'design', design: table({}) }, [], rand);
    expect(busy).toMatchObject({ ok: false, code: 'sheet_not_empty' });
  });
});
