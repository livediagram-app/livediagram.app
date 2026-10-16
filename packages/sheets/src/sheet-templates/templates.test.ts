// docs/specs/029-sheets/sheet.md "Sheet templates": every template builds a valid sheet whose formulas all read,
// works its example data out to the totals the spec states, places its charts over real ranges, and takes each look.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { book } from '../testing/book';
import { applySheetWrite } from '../store';
import { validateWrite } from '../validate';
import { cellKey } from '../sheet';
import { isError } from '../formula/values';
import { colWidth, posRangeOf, rowHeight } from '../layout';
import { SHEET_LOOKS, type SheetLook } from '../sheet-starters';
import { designWrite, designExtent, type TemplateSetup } from './compile';
import {
  SHEET_STARTS,
  SHEET_TEMPLATE_IDS,
  SHEET_TEMPLATES,
  isSheetTemplateId,
  sheetTemplateInfo,
  type SheetTemplateId,
} from './catalogue';
import { sheetTemplate } from './template-design';
import { mixHex, templateTints, SHEET_ACCENTS } from './accents';
import { mondayOf } from './work';
import { localMs, serialFromDate } from '../dates';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
// A Thursday.
const NOW = Date.UTC(2026, 9, 8, 15);

function make(id: SheetTemplateId, setup: Partial<TemplateSetup> = {}) {
  const b = book({}, { rows: 100, cols: 26 });
  const s = b.sheets[0]!;
  const design = sheetTemplate(id, NOW);
  const made = designWrite(b.wb, s.id, design, {
    look: 'banded',
    freezeHeader: true,
    size: 'default',
    dark: false,
    ...setup,
  });
  expect(made, id).not.toBeNull();
  expect(validateWrite(s, made!.write)).toEqual({ ok: true });
  const next = applySheetWrite(s, made!.write, ctx).sheet;
  b.wb.updateSheet(next);
  // A1-style reads: the value at "I5".
  const v = (a1: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(a1)!;
    const c = m[1]!.charCodeAt(0) - 65;
    return b.wb.value(next.id, Number(m[2]) - 1, c);
  };
  const at = (r: number, c: number) =>
    next.cells.get(cellKey(next.layout.rows[r]!, next.layout.cols[c]!));
  return { next, wb: b.wb, v, at, design, charts: made!.charts };
}

const near = (got: unknown, want: number) => expect(got as number).toBeCloseTo(want, 2);

describe('the sheet template catalogue', () => {
  it('lists every template once, each with its info, and Setup Sheet’s starts are Blank then them', () => {
    expect(SHEET_TEMPLATES.map((t) => t.id)).toEqual([...SHEET_TEMPLATE_IDS]);
    expect(SHEET_STARTS).toEqual(['blank', ...SHEET_TEMPLATE_IDS]);
    expect(new Set(SHEET_TEMPLATES.map((t) => t.name)).size).toBe(SHEET_TEMPLATES.length);
    expect(sheetTemplateInfo('loan').name).toBe('Loan Calculator');
    expect(isSheetTemplateId('invoice')).toBe(true);
    expect(isSheetTemplateId('budget-planner')).toBe(false);
    // A template that places a chart says which, for its preview.
    for (const t of SHEET_TEMPLATES)
      expect(t.chart, t.id).toBe(sheetTemplate(t.id, NOW).charts?.[0]?.kind);
  });

  it('mixes accents into light and dark tints, white header text on each', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    for (const a of SHEET_ACCENTS) {
      expect(templateTints(a, false).headInk).toBe('#ffffff');
      expect(templateTints(a, false).band).not.toBe(templateTints(a, true).band);
    }
  });
});

describe.each(SHEET_TEMPLATE_IDS)('%s', (id) => {
  it('builds a valid sheet whose every formula reads, titled, merged, sized and frozen', () => {
    const { next, wb, design, at } = make(id);
    for (const [key] of next.cells) {
      const [r, c] = key.split(':') as [string, string];
      const ri = next.layout.rows.indexOf(r);
      const ci = next.layout.cols.indexOf(c);
      const value = wb.value(next.id, ri, ci);
      expect(isError(value), `${id} ${ri + 1}:${ci + 1} ${JSON.stringify(value)}`).toBe(false);
    }
    expect(at(0, 0)).toMatchObject({ input: { s: design.heading }, format: { b: true, fs: 18 } });
    expect(next.layout.merges).toHaveLength(2);
    expect(next.layout.frozenRows).toBe(design.freeze || undefined);
    expect(next.layout.setupPending).toBeUndefined();
    expect(rowHeight(next.layout, next.layout.rows[0]!)).toBe(46);
    expect(colWidth(next.layout, next.layout.cols[0]!)).toBe(design.widths[0]);
    expect(designExtent(design).cols).toBeLessThanOrEqual(26);
  });

  it('places its charts over ranges of its own rows and columns', () => {
    const { next, charts, design } = make(id);
    expect(charts).toHaveLength(design.charts?.length ?? 0);
    for (const ch of charts) {
      expect(next.layout.rows).toContain(ch.range.r1);
      expect(next.layout.rows).toContain(ch.range.r2);
      expect(next.layout.cols).toContain(ch.range.c1);
      for (const c of ch.cols ?? []) expect(next.layout.cols).toContain(c);
      expect(ch.anchor.x).toBeGreaterThanOrEqual(0);
      expect(ch.anchor.y).toBeGreaterThan(0);
    }
  });

  it.each(SHEET_LOOKS)('takes the %s look', (look: SheetLook) => {
    const { next, design } = make(id, { look });
    const head = design.blocks.find((b) => b.kind === 'table')!;
    const cell = next.cells.get(
      cellKey(next.layout.rows[head.at[0]]!, next.layout.cols[head.at[1]]!),
    );
    expect(cell?.format?.b).toBe(true);
    if (look === 'plain') expect(cell?.format?.bg).toBeUndefined();
    if (look === 'header' || look === 'banded' || look === 'boxed')
      expect(cell?.format?.bg).toBeDefined();
    expect(next.layout.showGrid).toBe(look === 'minimal' ? false : undefined);
  });
});

describe('the example data works out', () => {
  it('Budget: totals, the summary and spending by category', () => {
    const { v } = make('budget');
    expect([v('C13'), v('D13'), v('E13')]).toEqual([2375, 2354, 21]);
    near(v('F13'), 2354 / 2375);
    expect([v('I5'), v('I8')]).toEqual([3200, 846]);
    expect([v('B17'), v('B18'), v('B19'), v('B20'), v('B21')]).toEqual([1364, 478, 120, 92, 300]);
  });

  it('Tracker: counts, progress and status counts', () => {
    const { v } = make('tracker');
    expect([v('K5'), v('K6'), v('K7')]).toEqual([8, 2, 1]);
    near(v('K9'), (100 + 100 + 60 + 30 + 10) / 800);
    expect([v('B17'), v('B18'), v('B19'), v('B20')]).toEqual([3, 2, 1, 2]);
    expect(v('H5')).toBe('Done');
  });

  it('Timesheet: Monday to Friday of this week, hours, billable time and the amount to bill', () => {
    const { v } = make('timesheet');
    expect(v('B5')).toBe(mondayOf(localMs(NOW)));
    expect((v('B12') as number) - (v('B5') as number)).toBe(4);
    expect([v('E13'), v('I7'), v('I10')]).toEqual([34.5, 32, 2080]);
    expect([v('B17'), v('B18'), v('B19')]).toEqual([21, 11, 2.5]);
  });

  it('Contacts: days since, who to follow up, the counts', () => {
    const { v } = make('contacts');
    expect(v('I7')).toBe('Follow Up');
    expect(v('I5')).toBe('');
    expect(v('I11')).toBe('3 due');
    expect(v('A11')).toBe('6 contacts');
  });

  it('Invoice: line amounts, tax and the amount due', () => {
    const { v } = make('invoice');
    expect([v('D19'), v('D21'), v('D22'), v('G8')]).toEqual([7230, 1446, 8676, 8676]);
    expect((v('G7') as number) - (v('G6') as number)).toBe(30);
  });

  it('Expense Report: claimed, missing receipts and reimbursable', () => {
    const { v } = make('expenses');
    near(v('E13'), 430.29);
    expect(v('I8')).toBe(2);
    near(v('I9'), 405.29);
    near(v('B17'), 190.999999);
  });

  it('Sales Pipeline: weighted values and the forecast', () => {
    const { v } = make('pipeline');
    expect(v('G5')).toBe(12000);
    expect([v('E13'), v('G13')]).toEqual([129500, 69800]);
    expect([v('K5'), v('K6'), v('K7')]).toEqual([119000, 63300, 6500]);
    near(v('K8'), 0.5);
  });

  it('Inventory: stock value and what to reorder', () => {
    const { v } = make('inventory');
    expect([v('H6'), v('H8'), v('H11'), v('H5')]).toEqual(['Reorder', 'Reorder', 'Reorder', 'OK']);
    expect(v('K7')).toBe(3);
    near(v('G13'), 204 + 225 + 134.4 + 50.4 + 216 + 387 + 89 + 227.5);
  });

  it('Guest List: the headcount', () => {
    const { v } = make('guests');
    expect([v('I5'), v('I6'), v('I7'), v('I8'), v('I9')]).toEqual([10, 20, 11, 5, 2]);
    near(v('I10'), 0.8);
    expect([v('B18'), v('B19'), v('B20'), v('B21')]).toEqual([11, 5, 2, 2]);
  });

  it('Grade Book: averages, grades and the class', () => {
    const { v } = make('grades');
    expect([v('G5'), v('H5'), v('H8'), v('H12')]).toEqual([91.8, 'A', 'D', 'F']);
    expect(v('K5')).toBe(8);
    near(v('K9'), 7 / 8);
    expect([v('B17'), v('B18'), v('B19'), v('B20'), v('B21')]).toEqual([2, 2, 1, 2, 1]);
  });

  it('Habit Tracker: ticks, progress against each goal and the best day', () => {
    const { v } = make('habits');
    expect([v('I5'), v('J5'), v('I11')]).toEqual([5, 7, 27]);
    near(v('K6'), 0.8);
    // Write a Journal met its goal of three.
    expect(v('N6')).toBe(1);
    expect(v('N7')).toBe('Mon');
  });

  it('Loan Calculator: the monthly payment and a schedule that ends at the term', () => {
    const { v } = make('loan');
    near(v('D5'), 1266.71);
    near(v('D7'), (v('D5') as number) * 360 - 250000);
    near(v('B11'), 250000);
    near(v('F40'), 0);
    // Interest and principal in a year make up what was paid.
    near((v('D11') as number) + (v('E11') as number), v('C11') as number);
  });
});

describe('cost', () => {
  it('builds every template in well under a frame', () => {
    const t0 = performance.now();
    for (const id of SHEET_TEMPLATE_IDS) make(id);
    const per = (performance.now() - t0) / SHEET_TEMPLATE_IDS.length;
    // Measured 0.2 to 1.2 ms each on a laptop (the Loan Calculator, 206 cells, the largest); the budget leaves room for
    // a slow CI machine.
    expect(per).toBeLessThan(100);
  });
});

// A template is dated in this person's time zone, as TODAY() reads it: made at 06:00 on a Monday in Sydney (20:00 UTC
// the Sunday before), its week starts that Monday and its today is that Monday.
describe('a template’s dates', () => {
  afterEach(() => vi.restoreAllMocks());
  it('are local, not UTC', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-600);
    const sundayEveningUtc = Date.UTC(2026, 9, 11, 20);
    const monday = serialFromDate(2026, 10, 12);
    const timesheet = sheetTemplate('timesheet', sundayEveningUtc);
    const table = timesheet.blocks.find((b) => b.kind === 'table')!;
    expect(table.kind === 'table' && table.rows[0]![1]).toEqual({ n: monday, date: true });
    const invoice = sheetTemplate('invoice', sundayEveningUtc);
    expect(JSON.stringify(invoice)).toContain(`"n":${monday},"date":true`);
  });
});

describe('the Habit Tracker’s checkboxes (data-validation.md)', () => {
  it('makes each habit’s days a Checkbox rule, ticked as TRUE, counted by COUNTIF', () => {
    const { next, v } = make('habits');
    expect(next.layout.rules).toHaveLength(1);
    expect(next.layout.rules![0]).toMatchObject({ is: 'check' });
    expect(posRangeOf(next.layout, next.layout.rules![0]!)).toEqual({ r1: 4, c1: 1, r2: 9, c2: 7 });
    expect(v('B5')).toBe(true);
    expect(v('D5')).toBe(false);
    expect(v('I5')).toBe(5);
  });
});
