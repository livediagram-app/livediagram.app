// docs/specs/029-sheets/sheet-store.md "Template starts", docs/specs/026-plan/plan-templates.md "Spreadsheet
// templates": every start builds a whole, valid sheet, set up as Setup Sheet would, and its formulas read.
import { describe, expect, it } from 'vitest';
import { Workbook } from './engine/workbook';
import { serialFromMs } from './dates';
import { sheetFromJson } from './sheet-json';
import { validateSheetCreate } from './validate';
import { isTemplateStart, templateSheet, templateStart, TEMPLATE_STARTS } from './template-starts';

// A Thursday, so the Timesheet's Monday is three days back.
const NOW = Date.UTC(2026, 9, 8, 15);
let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function made(start: (typeof TEMPLATE_STARTS)[number], dark = false) {
  const json = templateSheet({ id: `sheet-${start}`, tabId: 'tab1', start, now: NOW, dark, rand });
  expect(json, start).not.toBeNull();
  const sheet = sheetFromJson({
    ...json!,
    rev: 1,
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: null as never,
  });
  const wb = new Workbook({ sheets: [sheet], locale: 'en-GB' });
  return { json: json!, sheet, wb };
}

describe('template starts', () => {
  it('names the four starts and nothing else', () => {
    expect(TEMPLATE_STARTS).toEqual([
      'budget-planner',
      'timesheet',
      'contact-list',
      'task-tracker',
    ]);
    expect(isTemplateStart('timesheet')).toBe(true);
    expect(isTemplateStart('budget')).toBe(false);
    expect(isTemplateStart(undefined)).toBe(false);
  });

  it.each(TEMPLATE_STARTS)('%s builds a valid sheet with its header frozen and set up', (start) => {
    const { json, sheet } = made(start);
    expect(json.title).toBe(templateStart(start, NOW).title);
    expect(validateSheetCreate(sheet)).toEqual({ ok: true });
    expect(sheet.layout.frozenRows).toBe(1);
    expect(sheet.layout.setupPending).toBeUndefined();
    const rows = templateStart(start, NOW).start.rows;
    expect(sheet.layout.rows.length).toBeGreaterThanOrEqual(rows.length);
    // The header is bold on its tint.
    const head = sheet.cells.get(`${sheet.layout.rows[0]}:${sheet.layout.cols[0]}`);
    expect(head?.format?.b).toBe(true);
  });

  it('totals the Budget and works out each difference', () => {
    const { wb, json } = made('budget-planner');
    const v = (r: number, c: number) => wb.value(json.id, r, c);
    // Planned 2335, Actual 2314, Difference 21; Rent's difference 0, Groceries' -32.
    expect(v(8, 2)).toBe(2335);
    expect(v(8, 3)).toBe(2314);
    expect(v(8, 4)).toBe(21);
    expect(v(3, 4)).toBe(-32);
  });

  it('dates the Timesheet Monday to Friday of the week it is made, and totals the hours', () => {
    const { wb, json } = made('timesheet');
    const monday = wb.value(json.id, 1, 1) as number;
    const friday = wb.value(json.id, 5, 1) as number;
    expect(friday - monday).toBe(4);
    // 2026-10-05 is the Monday before 2026-10-08.
    expect(monday).toBe(Math.floor(serialFromMs(Date.UTC(2026, 9, 5))));
    expect(wb.value(json.id, 6, 4)).toBe(34);
  });

  it('tints for a dark canvas', () => {
    const light = made('contact-list').sheet;
    const dark = made('contact-list', true).sheet;
    const key = `${light.layout.rows[0]}:${light.layout.cols[0]}`;
    const darkKey = `${dark.layout.rows[0]}:${dark.layout.cols[0]}`;
    expect(light.cells.get(key)?.format?.bg).not.toBe(dark.cells.get(darkKey)?.format?.bg);
  });
});
