// A Dashboard's Sheet Chart (docs/specs/026-plan/plan-tabs.md "Sheet Chart"): the charts a Sheet already has, and the
// chart element a slot takes, a copy of one of them or a new one over a range typed as A1. Pure: the picker
// (SheetChartSource) and the slot (DashboardSheetChart) draw from it.
import {
  CHART_TYPE_LABELS,
  chartShapeOf,
  chartTypeOf,
  createShape,
  isChartShape,
  type ChartType,
  tabKindOf,
  type ChartSource,
  type ShapeElement,
  type Tab,
} from '@livepages/document';
import {
  formatRange,
  idRangeOf,
  parseRangeText,
  posRangeOf,
  type Sheet,
} from '@livepages/sheets';

export const NOT_A_RANGE = 'Not a range on this sheet';

const isSheetChart = (el: Tab['elements'][number]): el is ShapeElement =>
  el.type === 'shape' && isChartShape(el.shape) && !!el.chartSource;

// The charts drawn from `sheetId` on the document's tabs (a Dashboard's own slot charts left out), in tab order.
export function sheetChartsOf(tabs: readonly Tab[], sheetId: string): ShapeElement[] {
  return tabs.flatMap((t) =>
    tabKindOf(t) === 'dashboard'
      ? []
      : t.elements.filter(
          (el): el is ShapeElement => isSheetChart(el) && el.chartSource!.sheetId === sheetId,
        ),
  );
}

// "Column Chart · A1:C6": a chart's type and the range it reads now (its corner gone: just its type).
export function sheetChartLabel(el: ShapeElement, sheet: Sheet | null): string {
  const name = `${CHART_TYPE_LABELS[chartTypeOf(el) ?? 'column']} Chart`;
  const at = sheet && el.chartSource ? posRangeOf(sheet.layout, el.chartSource.range) : null;
  return at ? `${name} · ${formatRange(at)}` : name;
}

// What a slot's copy leaves behind of a chart: where it sat and what it belonged to on its own tab.
const NOT_COPIED = [
  'sheetAnchor',
  'layerId',
  'locked',
  'rotation',
  'commentThread',
  'link',
  'action',
  'actions',
  'note',
  'noteRich',
  'mindParentId',
  'mindFlow',
  'mindSpacing',
] as const;

// A slot's copy of a chart: the same type, range, columns and look, reading the same cells, as an element of its own.
export function slotChartFrom(src: ShapeElement): ShapeElement {
  const copy: Record<string, unknown> = { ...src };
  for (const k of NOT_COPIED) delete copy[k];
  return { ...(copy as ShapeElement), id: createShape(src.shape, 0, 0).id, x: 0, y: 0 };
}

// A new chart of `type` over the range typed as `text` ("A1:C6") on `sheet`, or null when it is not a range there.
export function newSlotChart(sheet: Sheet, text: string, type: ChartType): ShapeElement | null {
  const g = parseRangeText(text.trim().toUpperCase());
  const { rows, cols } = sheet.layout;
  if (!g || g.r2 >= rows.length || g.c2 >= cols.length) return null;
  const range = idRangeOf(sheet.layout, g.r1, g.c1, g.r2, g.c2);
  if (!range) return null;
  const chartSource: ChartSource = { sheetId: sheet.id, range };
  const { shape, chartVariant } = chartShapeOf(type);
  return { ...createShape(shape, 0, 0), ...(chartVariant ? { chartVariant } : {}), chartSource };
}
