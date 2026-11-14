// docs/specs/029-sheets/sheet-store.md "Template starts": a template's Sheets are made into sheets beside the tabs,
// on their tab, tinted for its canvas, and the mark dropped; anything else is left as it is.
import { describe, expect, it } from 'vitest';
import { sheetHeadersWrite, topRowTexts } from '@liveplanner/forms';
import { NOBODY, sheetFromJson } from '@liveplanner/sheets';
import { createShape, type Element, type ShapeElement } from '@liveplanner/project';
import { hasTemplateSheets, materialiseTemplateSheets } from './template-sheets';
import { buildPlanTemplate, planTemplateTabs } from './template-builders-plan';

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

  it('places the charts a template’s sheet has, anchored in its Sheet with their first read', () => {
    const { tabs: out, sheets } = materialiseTemplateSheets(
      [tab('t', buildPlanTemplate('budget-planner', 0, 0))],
      NOW,
    );
    const chart = out[0]!.elements.find(
      (el): el is ShapeElement => el.type === 'shape' && el.shape === 'pie-chart',
    );
    expect(chart?.chartSource?.sheetId).toBe(sheets[0]!.id);
    expect(chart?.sheetAnchor).toBeDefined();
    expect(chart?.pieSlices).toHaveLength(5);
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
      s.cells!.find((c) => c.r === s.layout!.rows[3] && c.c === s.layout!.cols[0])?.f?.bg;
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

  // docs/specs/030-forms/forms.md "In a plan template": the sheet a template's form feeds takes its tab's name.
  it('titles a template form’s responses sheet after its tab, and no other', () => {
    const defs = planTemplateTabs('event-planner');
    const ids = defs.map((_, i) => `t${i}`);
    const tabs = defs.map((d, i) => ({
      ...tab(ids[i]!, d.build(0, 0)),
      name: d.name ?? '',
      ...d.tab?.(ids),
    }));
    const { sheets } = materialiseTemplateSheets(tabs, NOW);
    const at = defs.findIndex((d) => d.name === 'RSVP Responses');
    expect(sheets.find((x) => x.tabId === ids[at])?.title).toBe('RSVP Responses');
    // Without a form feeding it, a blank sheet keeps its own title.
    const plain = materialiseTemplateSheets(
      tabs.map((t) => ({ ...t, form: undefined })),
      NOW,
    ).sheets;
    expect(plain.find((x) => x.tabId === ids[at])?.title).toBe('Sheet 1');
  });

  // docs/specs/030-forms/forms.md "In a plan template": the sheet a form feeds starts with the form's headers.
  it('writes a template form’s headers into its responses sheet, remembered, so nothing is written twice', () => {
    const defs = planTemplateTabs('event-planner');
    const ids = defs.map((_, i) => `t${i}`);
    const tabs = defs.map((d, i) => ({
      ...tab(ids[i]!, d.build(0, 0)),
      name: d.name ?? '',
      ...d.tab?.(ids),
    }));
    const { tabs: out, sheets } = materialiseTemplateSheets(tabs, NOW);
    const at = defs.findIndex((d) => d.name === 'RSVP Responses');
    const sheet = sheets.find((x) => x.tabId === ids[at])!;
    const form = out.find((t) => t.form)!.form!;
    const text = (r: string, c: string) => {
      const cell = sheet.cells!.find((x) => x.r === r && x.c === c)?.i;
      return cell && 's' in cell ? cell.s : undefined;
    };
    const headers = sheet.layout!.cols.map((c) => text(sheet.layout!.rows[0]!, c)).filter(Boolean);
    expect(headers.slice(0, 2)).toEqual(['#', 'Submitted']);
    expect(headers).toContain('Name');
    expect(Object.keys(form.sheet!.columns!)).toHaveLength(headers.length);
    // The editor's own plan, run on the made sheet, finds every header: it has nothing to write.
    const again = sheetHeadersWrite({
      form,
      layout: sheet.layout!,
      rowTexts: topRowTexts(
        sheetFromJson({
          ...sheet,
          id: sheet.id!,
          rev: 0,
          createdAt: NOW,
          updatedAt: NOW,
          updatedBy: NOBODY,
          cells: sheet.cells ?? [],
          layout: sheet.layout!,
        }),
      ),
      columns: form.sheet!.columns,
    });
    expect(again.write).toBeNull();
    // A sheet no form feeds stays blank.
    const plain = materialiseTemplateSheets(
      tabs.map((t) => ({ ...t, form: undefined })),
      NOW,
    ).sheets.find((x) => x.tabId === ids[at])!;
    expect(plain.cells ?? []).toEqual([]);
  });
});
