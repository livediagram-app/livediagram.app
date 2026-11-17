// Charts linked to a liveplanner sheet (each reader app's docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"; liveworkspace/docs/specs/004-index/sheet-sources.md): the pure half, one copy for livedocuments,
// livediagram and livedesign. Which charts on a tab are linked, the one key each distinct range is read under, what a
// read gives a chart, whether that changes what it stores, and the status words. Typed on the fields every product's
// chart shares, so each product's own element type passes through unchanged.
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import { chartFieldsFromTable } from '@liveworkspace/element-model/chart-table';
import {
  isChartShape,
  type LineSeries,
  type PieSlice,
} from '@liveworkspace/element-model/data-shapes';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import { formatRelativeTimeShort } from '@liveworkspace/ui';

// Any element of any product: what the helpers below need of one to tell a chart.
export type SheetLinkElement = { id: string; type: string };

// A chart's fields as every product stores them (the `pie*` names kept for pie and bar, the line's own two).
export type SheetChartFields = {
  shape: string;
  chartVariant?: unknown;
  pieSlices?: PieSlice[];
  lineCategories?: string[];
  lineSeries?: LineSeries[];
  chartSheetSource?: ChartSheetSource;
};

export type SheetChart = SheetLinkElement & SheetChartFields;
export type LinkedChart<E extends SheetLinkElement = SheetLinkElement> = E &
  SheetChartFields & { chartSheetSource: ChartSheetSource };

// Where a linked chart stands for the person looking at it.
// - reading: the first read is on its way (the saved values show meanwhile);
// - live: read with this person's own access, `read` the answer;
// - saved: this person cannot open the plan (or the link is not theirs to read), so the saved values show;
// - gone: the plan is there but the range's corner rows or columns are not;
// - failed: the read could not be made (offline, the plan's app down): Update tries again.
export type SheetLinkStatus =
  | { kind: 'reading' }
  | { kind: 'live'; read: SheetRangeRead }
  | { kind: 'saved' }
  | { kind: 'gone' }
  | { kind: 'failed' };

// A shape element of a chart kind (pie, bar, line), whatever its product.
export function isChart<E extends SheetLinkElement>(el: E): el is E & SheetChartFields {
  const shape = (el as { shape?: unknown }).shape;
  return el.type === 'shape' && typeof shape === 'string' && isChartShape(shape);
}

export const isLinkedChart = <E extends SheetLinkElement>(el: E): el is LinkedChart<E> =>
  isChart(el) && el.chartSheetSource !== undefined;

export function linkedChartsOn<E extends SheetLinkElement>(
  elements: readonly E[],
): LinkedChart<E>[] {
  return elements.filter(isLinkedChart);
}

// One read serves every chart drawing the same range of the same Sheet.
export function sheetLinkKey(s: ChartSheetSource): string {
  const { r1, c1, r2, c2 } = s.range;
  return `${s.itemId}|${s.sheetId}|${r1}:${c1}:${r2}:${c2}|${s.cols?.join(',') ?? ''}`;
}

// The data fields a read gives a chart, its colours kept.
export const liveChartFields = (el: SheetChartFields, read: SheetRangeRead) =>
  chartFieldsFromTable(el, read.table);

// The link as a read leaves it: the names, the range's A1 and the ids it reads now, and when.
export function sourceAfterRead(s: ChartSheetSource, read: SheetRangeRead): ChartSheetSource {
  return {
    ...s,
    itemName: read.itemName,
    sheetName: read.sheetName,
    range: read.range,
    a1: read.a1,
    readAt: read.readAt,
  };
}

// Whether a chart already stores what a read gives it (then an Editor's open writes nothing).
export function sameChartData(
  el: SheetChartFields,
  fields: ReturnType<typeof liveChartFields>,
): boolean {
  if ('pieSlices' in fields)
    return JSON.stringify(el.pieSlices ?? []) === JSON.stringify(fields.pieSlices);
  return (
    JSON.stringify(el.lineCategories ?? []) === JSON.stringify(fields.lineCategories) &&
    JSON.stringify(el.lineSeries ?? []) === JSON.stringify(fields.lineSeries)
  );
}

// Whether a stored link names the same plan, Sheet, range and names as a read would leave it.
export function sameSource(a: ChartSheetSource, b: ChartSheetSource): boolean {
  return (
    sheetLinkKey(a) === sheetLinkKey(b) &&
    a.itemName === b.itemName &&
    a.sheetName === b.sheetName &&
    a.a1 === b.a1
  );
}

// The element a person sees: a live read's values over the saved ones (the store is not changed by this).
export function chartAsSeen<E extends SheetChartFields>(
  el: E,
  status: SheetLinkStatus | undefined,
): E {
  if (status?.kind !== 'live') return el;
  const fields = liveChartFields(el, status.read);
  return sameChartData(el, fields) ? el : { ...el, ...fields };
}

// "updated 2 min ago" for a live read, "saved 2 hours ago" for values this person cannot refresh.
export function linkedAgo(readAt: number, now: number): string {
  return formatRelativeTimeShort(Math.max(0, now - readAt));
}

// The line a linked chart shows below its bottom edge, and its Data section's status.
export function sheetLinkLine(
  s: ChartSheetSource,
  status: SheetLinkStatus | undefined,
  now: number,
): { name: string; detail: string; tone: 'live' | 'quiet' | 'warn' } {
  const name = s.itemName || 'a plan';
  switch (status?.kind) {
    case 'live':
      return { name, detail: `updated ${linkedAgo(status.read.readAt, now)}`, tone: 'live' };
    case 'gone':
      return { name, detail: 'The linked range is gone', tone: 'warn' };
    case 'failed':
      return { name, detail: `Couldn't update, saved ${linkedAgo(s.readAt, now)}`, tone: 'warn' };
    default:
      return { name, detail: `saved ${linkedAgo(s.readAt, now)}`, tone: 'quiet' };
  }
}
