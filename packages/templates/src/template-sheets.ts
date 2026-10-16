// A template's Sheets made into sheets (docs/specs/029-sheets/sheet-store.md "Template starts",
// docs/specs/026-plan/plan-templates.md "Spreadsheet templates"): the one pure step every path that makes a template's
// tabs runs (the New Document wizard, Quick Start, the MCP's create_document and add_tab, the api's seeded create), so
// a template's sheet exists the moment its document does. The tabs come back with the mark dropped from each Sheet
// whose sheet was made, and the sheets to create beside them.
import type { SheetCreateRequest } from '@livediagram/api-schema';
import {
  chartFieldsFromTable,
  createShape,
  isLightColor,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import {
  isTemplateStart,
  templateSheetWithCharts,
  type TemplateStartId,
} from '@livediagram/sheets';

type Rand = () => number;

export { hasTemplateSheets } from './template-sheet-marks';

// A Sheet element naming a template start, with the start it names.
function startOf(el: Element): TemplateStartId | null {
  if (el.type !== 'shape' || el.shape !== 'plan-sheet') return null;
  const start = el.planSheet?.start;
  return isTemplateStart(start) && el.planSheet?.sheetId ? start : null;
}

// Where a template's chart sits on the canvas, for what does not draw the grid (exports, agents): over its Sheet's
// top right, as Insert Chart places one (sheet.md "Charts"); the Sheet draws it at its anchor.
const CHART_INSET_PX = 24;
const CHART_TOP_PX = 120;

// The chart elements a template's charts make beside its Sheet `sheetEl` (sheet.md "Charts"): each anchored in the
// Sheet, carrying its first read and its accent's palette, its canvas place over the Sheet's top right.
export function templateChartElements(
  sheetEl: { x: number; y: number; width: number; height: number },
  sheetId: string,
  charts: NonNullable<ReturnType<typeof templateSheetWithCharts>>['charts'],
): ShapeElement[] {
  return charts.map((ch) => {
    const base: ShapeElement = {
      ...createShape(ch.kind, 0, 0),
      width: ch.width,
      height: ch.height,
      chartSource: { sheetId, range: ch.range, ...(ch.cols ? { cols: ch.cols } : {}) },
      sheetAnchor: ch.anchor,
      chartPalette: ch.palette,
    };
    return {
      ...base,
      ...chartFieldsFromTable(base, ch.table),
      x: Math.max(sheetEl.x, sheetEl.x + sheetEl.width - CHART_INSET_PX - ch.width),
      y: sheetEl.y + Math.min(CHART_TOP_PX, Math.max(0, sheetEl.height - ch.height)),
    };
  });
}

// Each tab's template Sheets made into sheets (on their tab, tinted for its canvas), the charts their templates place
// added beside them (anchored in the Sheet, carrying their first read), and the tabs with the mark dropped from every
// Sheet whose sheet was made. A Sheet whose start would not build keeps its mark, so the editor
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
    const charts: Element[] = [];
    const elements = tab.elements.map((el): Element => {
      const start = startOf(el);
      if (!start || el.type !== 'shape' || !el.planSheet) return el;
      const sheetId = el.planSheet.sheetId;
      const made = templateSheetWithCharts({ id: sheetId, tabId: tab.id, start, now, dark, rand });
      if (!made) return el;
      sheets.push(made.sheet);
      charts.push(...templateChartElements(el, sheetId, made.charts));
      const { start: _made, ...ref } = el.planSheet;
      return { ...el, planSheet: ref };
    });
    return { ...tab, elements: charts.length ? [...elements, ...charts] : elements };
  });
  return { tabs: out, sheets };
}
