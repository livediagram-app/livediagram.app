// A template's Sheets made into sheets (docs/specs/029-sheets/sheet-store.md "Template starts",
// docs/specs/026-plan/plan-templates.md "Spreadsheet templates"): the one pure step every path that makes a template's
// tabs runs (the New Project wizard, Quick Start, the MCP's create_project and add_tab, the api's seeded create), so
// a template's sheet exists the moment its project does. The tabs come back with the mark dropped from each Sheet
// whose sheet was made, and the sheets to create beside them.
import type { SheetCreateRequest } from '@liveplanner/api-schema';
import {
  chartFieldsFromTable,
  createShape,
  isLightColor,
  type Element,
  type ShapeElement,
  type Tab,
} from '@liveplanner/project';
import { sheetHeadersWrite, topRowTexts, type FormDefinition } from '@liveplanner/forms';
import {
  applySheetWrite,
  isTemplateStart,
  NOBODY,
  sheetFromJson,
  sheetToJson,
  templateSheetWithCharts,
  type TemplateStartId,
} from '@liveplanner/sheets';

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
// A sheet a template's Form tab sends its responses to is titled after its tab ("RSVP Responses"), as a responses
// sheet Start Planning makes is (docs/specs/030-forms/forms.md "In a plan template"); every other keeps its own.
function formSheetTitles(tabs: readonly Partial<Pick<Tab, 'id' | 'name' | 'form'>>[]) {
  const names = new Map(tabs.map((t) => [t.id, t.name]));
  const out = new Map<string, string>();
  for (const t of tabs) {
    const to = t.form?.sheet;
    const name = to && names.get(to.tabId);
    if (to && name) out.set(to.sheetId, name);
  }
  return out;
}

// A form's sheet given the headers its form wants (forms.md "Columns before any response"), so a new plan's responses
// sheet is not blank until the Form tab is opened. The editor's sync then finds each header already there: it plans
// by the remembered columns, so nothing is written twice. `form` is the tab's form pointing at the sheet.
function withFormHeaders(
  sheet: SheetCreateRequest,
  form: FormDefinition,
  now: number,
): { sheet: SheetCreateRequest; columns: Record<string, string> } {
  const full = sheetFromJson({
    id: sheet.id ?? '',
    tabId: sheet.tabId,
    title: sheet.title,
    layout: sheet.layout!,
    cells: sheet.cells ?? [],
    rev: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: NOBODY,
  });
  const { write, columns } = sheetHeadersWrite({
    form,
    layout: full.layout,
    rowTexts: topRowTexts(full),
    columns: form.sheet?.columns,
  });
  if (!write) return { sheet, columns };
  const json = sheetToJson(applySheetWrite(full, write, { now, by: NOBODY }).sheet);
  return { sheet: { ...sheet, layout: json.layout, cells: json.cells }, columns };
}

export function materialiseTemplateSheets<
  T extends Pick<Tab, 'id' | 'elements'> &
    Partial<Pick<Tab, 'name' | 'form'>> & { backgroundColor?: string },
>(
  tabs: readonly T[],
  now: number,
  rand: Rand = Math.random,
): { tabs: T[]; sheets: SheetCreateRequest[] } {
  const sheets: SheetCreateRequest[] = [];
  const titles = formSheetTitles(tabs);
  // The Form tab whose responses go to each sheet, and the columns its headers were given.
  const formOf = new Map(
    tabs.flatMap((t) => (t.form?.sheet ? [[t.form.sheet.sheetId, t.form] as const] : [])),
  );
  const columnsOf = new Map<string, Record<string, string>>();
  const made = tabs.map((tab) => {
    if (!tab.elements.some((el) => startOf(el) !== null)) return tab;
    const dark = !!tab.backgroundColor && !isLightColor(tab.backgroundColor);
    const charts: Element[] = [];
    const elements = tab.elements.map((el): Element => {
      const start = startOf(el);
      if (!start || el.type !== 'shape' || !el.planSheet) return el;
      const sheetId = el.planSheet.sheetId;
      const built = templateSheetWithCharts({ id: sheetId, tabId: tab.id, start, now, dark, rand });
      if (!built) return el;
      const title = titles.get(sheetId);
      let sheet: SheetCreateRequest = title ? { ...built.sheet, title } : built.sheet;
      const form = formOf.get(sheetId);
      if (form) {
        const headed = withFormHeaders(sheet, form, now);
        sheet = headed.sheet;
        columnsOf.set(sheetId, headed.columns);
      }
      sheets.push(sheet);
      charts.push(...templateChartElements(el, sheetId, built.charts));
      const { start: _made, ...ref } = el.planSheet;
      return { ...el, planSheet: ref };
    });
    return { ...tab, elements: charts.length ? [...elements, ...charts] : elements };
  });
  // Each Form tab remembers the column of every header it gave its sheet, as the editor's sync does.
  const out = made.map((tab) => {
    const at = tab.form?.sheet;
    const columns = at && columnsOf.get(at.sheetId);
    return columns && tab.form ? { ...tab, form: { ...tab.form, sheet: { ...at, columns } } } : tab;
  });
  return { tabs: out, sheets };
}
