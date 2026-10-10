// docs/specs/029-sheets/sheet-store.md "Template starts": a template's Sheets are made into sheets beside the tabs,
// on their tab, tinted for its canvas, and the mark dropped; anything else is left as it is.
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { hasTemplateSheets, materialiseTemplateSheets } from './template-sheets';
import { buildPlanTemplate } from './template-builders-plan';

const NOW = Date.UTC(2026, 9, 8);
const tab = (id: string, elements: Element[], backgroundColor = '#ffffff') => ({
  id,
  elements,
  backgroundColor,
});

describe('materialiseTemplateSheets', () => {
  it('makes each marked Sheet’s sheet on its tab and drops the mark', () => {
    const els = buildPlanTemplate('task-tracker', 0, 0);
    const tabs = [tab('t1', els), tab('t2', [createShape('square', 0, 0)])];
    expect(hasTemplateSheets(tabs)).toBe(true);
    const { tabs: out, sheets } = materialiseTemplateSheets(tabs, NOW);
    expect(sheets).toHaveLength(1);
    const sheetEl = out[0]!.elements.find((el) => el.type === 'shape' && el.shape === 'plan-sheet');
    const ref = (sheetEl as { planSheet: { sheetId: string; start?: string } }).planSheet;
    expect(ref.start).toBeUndefined();
    expect(sheets[0]).toMatchObject({ id: ref.sheetId, tabId: 't1', title: 'Tracker' });
    expect(sheets[0]!.cells!.length).toBeGreaterThan(0);
    expect(hasTemplateSheets(out)).toBe(false);
    // A tab with nothing to make is the same tab.
    expect(out[1]).toBe(tabs[1]);
  });

  it('keeps Fill Tab and tints the header for a dark canvas', () => {
    const light = materialiseTemplateSheets([tab('t', buildPlanTemplate('timesheet', 0, 0))], NOW);
    const dark = materialiseTemplateSheets(
      [tab('t', buildPlanTemplate('timesheet', 0, 0), '#0f172a')],
      NOW,
    );
    const el = light.tabs[0]!.elements[0] as { planSheet: { fillTab?: true } };
    expect(el.planSheet.fillTab).toBe(true);
    const headBg = (s: (typeof light.sheets)[number]) =>
      s.cells!.find((c) => c.r === s.layout!.rows[0] && c.c === s.layout!.cols[0])?.f?.bg;
    expect(headBg(light.sheets[0]!)).not.toBe(headBg(dark.sheets[0]!));
  });

  it('leaves a Sheet with no start, or an unknown one, alone', () => {
    const plain = { ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'sheet00001' } };
    const unknown = { ...plain, planSheet: { sheetId: 'sheet00002', start: 'mystery' } };
    const tabs = [tab('t', [plain, unknown] as Element[])];
    // Marked, so a caller loads the engine to look; nothing it knows is made, and the mark stays for the editor.
    expect(hasTemplateSheets(tabs)).toBe(true);
    expect(hasTemplateSheets([tab('t', [plain] as Element[])])).toBe(false);
    const { tabs: out, sheets } = materialiseTemplateSheets(tabs, NOW);
    expect(sheets).toEqual([]);
    expect(out[0]).toBe(tabs[0]);
  });
});
