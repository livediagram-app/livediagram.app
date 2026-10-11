// docs/specs/029-sheets/sheet-store.md "Template starts", docs/specs/026-plan/plan-templates.md "Spreadsheet
// templates": every Plan template's start builds a whole, valid sheet from its sheet template, Banded, header frozen.
import { describe, expect, it } from 'vitest';
import { sheetFromJson } from './sheet-json';
import { validateSheetCreate } from './validate';
import {
  isTemplateStart,
  sheetFromTemplate,
  templateSheetWithCharts,
  TEMPLATE_START_SHEETS,
  TEMPLATE_STARTS,
} from './template-starts';
import { sheetTemplateInfo } from './sheet-templates/catalogue';
import { sheetTemplate } from './sheet-templates/template-design';

const NOW = Date.UTC(2026, 9, 8, 15);
let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('template starts', () => {
  it('names the twelve starts and nothing else', () => {
    expect(TEMPLATE_STARTS).toEqual([
      'budget-planner',
      'timesheet',
      'contact-list',
      'task-tracker',
      'invoice',
      'expense-report',
      'loan-calculator',
      'sales-pipeline',
      'inventory',
      'guest-list',
      'grade-book',
      'habit-tracker',
    ]);
    expect(isTemplateStart('timesheet')).toBe(true);
    expect(isTemplateStart('budget')).toBe(false);
    expect(isTemplateStart(undefined)).toBe(false);
  });

  it.each(TEMPLATE_STARTS)(
    '%s builds its sheet template, valid and frozen through its header',
    (start) => {
      const json = templateSheetWithCharts({
        id: `sheet-${start}`,
        tabId: 'tab1',
        start,
        now: NOW,
        dark: false,
        rand,
      })?.sheet;
      expect(json).not.toBeNull();
      const design = sheetTemplate(TEMPLATE_START_SHEETS[start], NOW);
      expect(json!.title).toBe(sheetTemplateInfo(TEMPLATE_START_SHEETS[start]).name);
      const sheet = sheetFromJson({
        ...json!,
        rev: 1,
        createdAt: NOW,
        updatedAt: NOW,
        updatedBy: null as never,
      });
      expect(validateSheetCreate(sheet)).toEqual({ ok: true });
      expect(sheet.layout.frozenRows ?? 0).toBe(design.freeze ?? 0);
      expect(sheet.layout.setupPending).toBeUndefined();
    },
  );

  it('hands back the charts that sit over the Budget', () => {
    const made = templateSheetWithCharts({
      id: 'sheet-b',
      tabId: 't',
      start: 'budget-planner',
      now: NOW,
      dark: false,
      rand,
    });
    expect(made!.charts).toHaveLength(1);
    expect(made!.charts[0]!.kind).toBe('pie-chart');
    expect(made!.charts[0]!.table).toEqual({
      categories: ['Home', 'Food', 'Travel', 'Leisure', 'Savings'],
      series: [{ name: 'Spent', values: [1364, 478, 120, 92, 300] }],
    });
  });

  it('reads the Loan Calculator’s chart by year, interest and principal', () => {
    const made = sheetFromTemplate({
      id: 'sheet-l',
      tabId: 't',
      template: 'loan',
      now: NOW,
      dark: false,
      rand,
    });
    const t = made!.charts[0]!.table;
    expect(t.categories).toHaveLength(30);
    expect([t.categories[0], t.categories[29]]).toEqual(['1', '30']);
    expect(t.series.map((x) => x.name)).toEqual(['Interest', 'Principal']);
    expect(t.series[0]!.values[0]).toBeGreaterThan(t.series[0]!.values[29]!);
  });

  it('tints for a dark canvas', () => {
    const head = (dark: boolean) => {
      const s = templateSheetWithCharts({
        id: 'sheet-c',
        tabId: 't',
        start: 'contact-list',
        now: NOW,
        dark,
        rand,
      })!.sheet;
      return s.cells.find((c) => c.r === s.layout.rows[3] && c.c === s.layout.cols[0])?.f?.bg;
    };
    expect(head(false)).not.toBe(head(true));
  });
});
