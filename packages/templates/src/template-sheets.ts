// A template's Sheets made into sheets (docs/specs/029-sheets/sheet-store.md "Template starts",
// docs/specs/026-plan/plan-templates.md "Spreadsheet templates"): the one pure step every path that makes a template's
// tabs runs (the New Document wizard, Quick Start, the MCP's create_document and add_tab, the api's seeded create), so
// a template's sheet exists the moment its document does. The tabs come back with the mark dropped from each Sheet
// whose sheet was made, and the sheets to create beside them.
import type { SheetCreateRequest } from '@livediagram/api-schema';
import { isLightColor, type Element, type Tab } from '@livediagram/document';
import { isTemplateStart, templateSheet, type TemplateStartId } from '@livediagram/sheets';

type Rand = () => number;

export { hasTemplateSheets } from './template-sheet-marks';

// A Sheet element naming a template start, with the start it names.
function startOf(el: Element): TemplateStartId | null {
  if (el.type !== 'shape' || el.shape !== 'plan-sheet') return null;
  const start = el.planSheet?.start;
  return isTemplateStart(start) && el.planSheet?.sheetId ? start : null;
}

// Each tab's template Sheets made into sheets (on their tab, tinted for its canvas), and the tabs with the mark
// dropped from every Sheet whose sheet was made. A Sheet whose start would not build keeps its mark, so the editor
// tries it when it is drawn.
export function materialiseTemplateSheets<
  T extends Pick<Tab, 'id' | 'elements'> & { backgroundColor?: string },
>(
  tabs: readonly T[],
  now: number,
  rand: Rand = Math.random,
): { tabs: T[]; sheets: SheetCreateRequest[] } {
  const sheets: SheetCreateRequest[] = [];
  const out = tabs.map((tab) => {
    if (!tab.elements.some((el) => startOf(el) !== null)) return tab;
    const dark = !!tab.backgroundColor && !isLightColor(tab.backgroundColor);
    const elements = tab.elements.map((el): Element => {
      const start = startOf(el);
      if (!start || el.type !== 'shape' || !el.planSheet) return el;
      const made = templateSheet({
        id: el.planSheet.sheetId,
        tabId: tab.id,
        start,
        now,
        dark,
        rand,
      });
      if (!made) return el;
      sheets.push(made);
      const { start: _made, ...ref } = el.planSheet;
      return { ...el, planSheet: ref };
    });
    return { ...tab, elements };
  });
  return { tabs: out, sheets };
}
