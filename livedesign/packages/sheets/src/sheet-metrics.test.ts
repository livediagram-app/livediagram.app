import { describe, expect, it } from 'vitest';
import { Workbook } from './engine/workbook';
import { makeSheets } from './testing/book';
import { cellKey, type Sheet } from './sheet';
import { sheetFromJson } from './sheet-json';
import { sheetFromTemplate } from './template-starts';
import { SHEET_TEMPLATE_IDS, type SheetTemplateId } from './sheet-templates/catalogue';
import { HEAD_ROW } from './sheet-templates/design';
import {
  a1OfRef,
  cellRefFromA1,
  columnTrend,
  figureSuggestions,
  numberColumns,
  sheetColumn,
  sheetFigure,
  sparklineOf,
  summarise,
} from './sheet-metrics';

// docs/specs/026-plan/plan-tabs.md "Figures from a Sheet".
function budget() {
  const [sheet] = makeSheets({
    Budget: {
      A1: 'Item',
      B1: 'Spent',
      A2: 'Rent',
      B2: '1200',
      A3: 'Food',
      B3: '350',
      A4: 'Travel',
      B4: '90',
      A6: 'Total',
      B6: '=SUM(B2:B4)',
      D1: 'Target',
      D2: '2000',
    },
  });
  return { sheet: sheet!, wb: new Workbook({ sheets: [sheet!], locale: 'en-GB' }) };
}

describe('a figure from a Sheet', () => {
  it('reads a cell by its ids, labelled by the text to its left, and follows its address', () => {
    const { sheet, wb } = budget();
    const ref = cellRefFromA1(sheet, 'b6')!;
    expect(a1OfRef(sheet, ref)).toBe('B6');
    expect(sheetFigure(wb, sheet, ref, 'en-GB')).toMatchObject({
      value: 1640,
      label: 'Total',
      a1: 'B6',
    });
    expect(cellRefFromA1(sheet, 'nope')).toBeNull();
  });

  it('labels a number with no text beside it by its column’s header', () => {
    const { sheet, wb } = budget();
    expect(sheetFigure(wb, sheet, cellRefFromA1(sheet, 'D2')!, 'en-GB')!.label).toBe('Target');
  });

  it('suggests the labelled numbers, the foot first', () => {
    const { sheet, wb } = budget();
    const s = figureSuggestions(wb, sheet, 'en-GB');
    expect(s[0]).toMatchObject({ label: 'Total', value: 1640 });
    expect(s.map((f) => f.label)).toContain('Rent');
  });
});

describe('a column from a Sheet', () => {
  it('reads its numbers below its header, and lists the columns that hold numbers', () => {
    const { sheet, wb } = budget();
    const spent = sheetColumn(wb, sheet, sheet.layout.cols[1]!)!;
    expect(spent.label).toBe('Spent');
    // The Total row is the column's sum, not one of its numbers.
    expect(spent.values).toEqual([1200, 350, 90]);
    expect(numberColumns(wb, sheet).map((c) => c.label)).toEqual(['Spent', 'Target']);
  });

  it('summarises a column, a count of nothing being 0', () => {
    expect(summarise([1, 2, 3], 'sum')).toBe(6);
    expect(summarise([1, 2, 3], 'average')).toBe(2);
    expect(summarise([1, 2, 3], 'min')).toBe(1);
    expect(summarise([1, 2, 3], 'max')).toBe(3);
    expect(summarise([], 'count')).toBe(0);
    expect(summarise([], 'sum')).toBeNull();
  });

  it('reads a trend as the last value against the one before', () => {
    expect(columnTrend([10, 12, 15])).toEqual({ last: 15, previous: 12, change: 3, ratio: 0.25 });
    expect(columnTrend([7])).toEqual({ last: 7, previous: null, change: null, ratio: null });
    expect(columnTrend([0, 5])!.ratio).toBeNull();
    expect(columnTrend([])).toBeNull();
  });

  it('samples a long column for its sparkline, keeping the last', () => {
    const long = Array.from({ length: 500 }, (_, i) => i);
    const s = sparklineOf(long, 40);
    expect(s).toHaveLength(40);
    expect(s.at(-1)).toBe(499);
    expect(sparklineOf([1, 2])).toEqual([1, 2]);
  });
});

// A template's sheet (sheet.md "Sheet templates"): a title and subtitle above the main table's header (row 4), a total
// row under its body (bold, ruled above), and, for most, the chart's data in a second table below.
function template(id: SheetTemplateId): { sheet: Sheet; wb: Workbook } {
  const made = sheetFromTemplate({
    id: 'sheetT0001',
    tabId: 't',
    template: id,
    now: Date.UTC(2026, 9, 11),
    dark: false,
  })!;
  const sheet = sheetFromJson({
    ...made.sheet,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: 'x', name: 'x', color: '#000000' },
  });
  return { sheet, wb: new Workbook({ sheets: [sheet], locale: 'en-GB' }) };
}

describe('a column of a template’s sheet', () => {
  it('reads the Budget’s Planned column under its header, leaving the total out', () => {
    const { sheet, wb } = template('budget');
    const planned = sheetColumn(wb, sheet, sheet.layout.cols[2]!)!;
    expect(planned.label).toBe('Planned');
    expect(summarise(planned.values, 'sum')).toBe(2375);
    expect(planned.values).toHaveLength(8);
    // The Item column holds text in the main table: its numbers are the chart's Spent below.
    expect(sheetColumn(wb, sheet, sheet.layout.cols[1]!)!.label).toBe('Spent');
  });

  it('reads the Loan’s schedule, not the loan’s fields above it', () => {
    const { sheet, wb } = template('loan');
    const opening = sheetColumn(wb, sheet, sheet.layout.cols[1]!)!;
    expect(opening.label).toBe('Opening Balance');
    expect(opening.values).toHaveLength(30);
  });

  it('stops the Invoice’s Amount column at its Subtotal', () => {
    const { sheet, wb } = template('invoice');
    const amount = sheetColumn(wb, sheet, sheet.layout.cols[3]!)!;
    expect(amount.label).toBe('Amount');
    expect(summarise(amount.values, 'sum')).toBe(7230);
  });

  it('leaves text inside a column of numbers out, keeping its header', () => {
    const { sheet, wb } = template('tracker');
    const left = sheetColumn(wb, sheet, sheet.layout.cols[7]!)!;
    expect(left.label).toBe('Days Left');
    expect(left.values).toHaveLength(6);
  });

  // Every template whose main table heads row 4 (the Loan's and the Invoice's sit lower, under fields: above): each
  // column of it holding numbers reads under its own header, its body's numbers exactly, never its total row (nor a
  // table stacked under one that has no total).
  it.each(SHEET_TEMPLATE_IDS.filter((id) => id !== 'loan' && id !== 'invoice'))(
    'reads every main-table column of %s under its header',
    (id) => {
      const { sheet, wb } = template(id);
      const { rows, cols } = wb.extent(sheet.id);
      const fmt = (r: number, c: number) =>
        sheet.cells.get(cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!))?.format;
      // The main table ends at its total row, or (a table with none) at its first empty row.
      let end = HEAD_ROW + 1;
      while (
        end < rows &&
        !(fmt(end, 0)?.b && fmt(end, 0)?.bt) &&
        wb.value(sheet.id, end, 0) !== null
      )
        end++;
      let checked = 0;
      for (let c = 0; c < cols; c++) {
        const head = wb.value(sheet.id, HEAD_ROW, c);
        if (typeof head !== 'string' || !head.trim()) continue;
        const body: number[] = [];
        for (let r = HEAD_ROW + 1; r < end; r++) {
          const v = wb.value(sheet.id, r, c);
          if (typeof v === 'number') body.push(v);
        }
        if (body.length < 2) continue;
        const col = sheetColumn(wb, sheet, sheet.layout.cols[c]!)!;
        expect(col.label, `${id} column ${c}`).toBe(head.trim());
        expect(col.values, `${id} column ${c}`).toEqual(body);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    },
  );
});
