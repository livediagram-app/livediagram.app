// Charts read live from their sheets, for a picture drawn without a browser (docs/specs/029-sheets/sheet.md "Charts":
// a chart's data is read live; docs/specs/015-api/mcp-server.md §5): each chart element linked to a sheet given here
// takes the values its range holds now, rather than those it was saved with, so a preview after a change to its cells
// shows the change. Pure.
import { chartFieldsFromTable, type Element, type ShapeElement } from '@livedesign/document';
import {
  AGENT_LOCALE,
  Workbook,
  sheetChartTable,
  sheetFromJson,
  type SheetJson,
} from '@livedesign/sheets';

// The element as a shape, when it is one: narrowing on `type` does not reach through a generic.
const shapeOf = (el: Element): ShapeElement | undefined => (el.type === 'shape' ? el : undefined);

export function chartsReadLive<E extends Element>(
  elements: readonly E[],
  sheets: readonly SheetJson[],
): E[] {
  const linked = elements.some((el) => shapeOf(el)?.chartSource);
  if (!linked || sheets.length === 0) return [...elements];
  const wb = new Workbook({ sheets: sheets.map(sheetFromJson), locale: AGENT_LOCALE });
  return elements.map((el) => {
    const source = shapeOf(el)?.chartSource;
    if (!source || !wb.sheet(source.sheetId)) return el;
    const table = sheetChartTable(wb, source, wb.locale);
    return table ? { ...el, ...chartFieldsFromTable(el as ShapeElement, table) } : el;
  });
}
