// Charts and tables with live data from a liveplanner plan (liveworkspace/docs/specs/004-index/live-data.md; each
// reader app's docs/specs/009-elements/pie-chart.md "Live data from a plan"): the pure half, one copy for every reader
// app. Which elements on a tab are linked, the one key each distinct source is read under, what a read gives an
// element, whether that changes what it stores, and the status words. Typed on the fields every product's chart and
// table share, so each product's own element type passes through unchanged.
import {
  isRangeSource,
  type ChartSheetSource,
} from '@liveworkspace/element-model/chart-sheet-source';
import { chartFieldsFromTable, type ChartTable } from '@liveworkspace/element-model/chart-table';
import {
  isChartShape,
  type LineSeries,
  type PieSlice,
} from '@liveworkspace/element-model/data-shapes';
import {
  liveTablePatch,
  pickSeries,
  tableCellsFromRead,
} from '@liveworkspace/element-model/live-data-table';
import {
  PLAN_DATA_CARDS,
  type PlanDataRead,
  type SheetRangeRead,
} from '@liveworkspace/index-client';
import { formatRelativeTimeShort } from '@liveworkspace/ui';

// Any element of any product: what the helpers below need of one to tell a chart or a table.
export type SheetLinkElement = { id: string; type: string };

// A chart's fields as every product stores them (the `pie*` names kept for pie and bar, the line's own two).
export type SheetChartFields = {
  shape: string;
  chartVariant?: unknown;
  pieSlices?: PieSlice[];
  lineCategories?: string[];
  lineSeries?: LineSeries[];
  chartSheetSource?: ChartSheetSource;
  // Meant to come from a sheet, not linked yet (pie-chart.md "Not linked yet"): its numbers are samples.
  chartSheetPending?: boolean;
};

// A table's fields as every product stores them.
export type LiveTableFields = {
  cells: string[][];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  cellStyles?: unknown[][];
  headerRow?: boolean;
  chartSheetSource?: ChartSheetSource;
};

export type SheetChart = SheetLinkElement & SheetChartFields;
export type LiveTable = SheetLinkElement & LiveTableFields & { type: 'table' };
// An element that takes live data: a chart or a table.
export type Linkable = SheetChart | LiveTable;
export type LinkedChart<E extends SheetLinkElement = SheetLinkElement> = E & {
  chartSheetSource: ChartSheetSource;
};

// What a read answers, whatever its kind: the plan's name, the table and when.
export type LiveRead = SheetRangeRead | PlanDataRead;

// Where a linked element stands for the person looking at it.
// - reading: the first read is on its way (the saved values show meanwhile);
// - live: read with this person's own access, `read` the answer;
// - saved: this person cannot open the plan (or the link is not theirs to read), so the saved values show;
// - gone: the plan is there but the range's corner rows or columns are not;
// - failed: the read could not be made (offline, the plan's app down): Update tries again;
// - frozen: Freeze kept the numbers; nothing is read.
export type SheetLinkStatus =
  | { kind: 'reading' }
  | { kind: 'live'; read: LiveRead }
  | { kind: 'saved' }
  | { kind: 'gone' }
  | { kind: 'failed' }
  | { kind: 'frozen' };

// A shape element of a chart kind (pie, bar, line), whatever its product.
export function isChart<E extends SheetLinkElement>(el: E): el is E & SheetChartFields {
  const shape = (el as { shape?: unknown }).shape;
  return el.type === 'shape' && typeof shape === 'string' && isChartShape(shape);
}

export const isLiveTable = <E extends SheetLinkElement>(el: E): el is E & LiveTable =>
  el.type === 'table' && Array.isArray((el as { cells?: unknown }).cells);

// A chart or a table: an element that takes live data.
export const isLinkable = <E extends SheetLinkElement>(el: E): el is E & Linkable =>
  isChart(el) || isLiveTable(el);

export const isLinkedChart = <E extends SheetLinkElement>(el: E): el is LinkedChart<E> =>
  isLinkable(el) && (el as Linkable).chartSheetSource !== undefined;

export function linkedChartsOn<E extends SheetLinkElement>(
  elements: readonly E[],
): LinkedChart<E>[] {
  return elements.filter(isLinkedChart);
}

// One read serves every element drawing the same source: a Sheet's range, a board's count, a metric.
export function sheetLinkKey(s: ChartSheetSource): string {
  if (isRangeSource(s)) {
    const { r1, c1, r2, c2 } = s.range;
    return `${s.itemId}|${s.sheetId}|${r1}:${c1}:${r2}:${c2}|${s.cols?.join(',') ?? ''}`;
  }
  if (s.kind === 'board')
    return `board|${s.itemId}|${s.boardId}|${s.by}|${JSON.stringify(s.filter ?? {})}`;
  return `metric|${s.itemId}|${s.metric}`;
}

// Whether a room's `source-changed` frame (its plan and the ids it names) touches this source: a range by its Sheet's
// id, a board or a metric by the plan's cards.
export function frameTouches(s: ChartSheetSource, planId: string, ids: readonly string[]): boolean {
  if (s.itemId !== planId) return false;
  return ids.includes(isRangeSource(s) ? s.sheetId : PLAN_DATA_CARDS);
}

// The heading over a linked table's label column: the range's first cell is not read, so its words come from the
// source.
const labelHeading = (s: ChartSheetSource | undefined): string => {
  // A metric's one series is already named for it ("Priorities"): naming the label column the same said it twice.
  if (!s || isRangeSource(s) || s.kind === 'metric') return '';
  return { column: 'Column', label: 'Label', assignee: 'Assignee', priority: 'Priority' }[s.by];
};

// The data fields a read gives an element: a chart's slices or series (colours kept), a table's cells; null when the
// element already stores them, so an Editor's open writes nothing.
export function liveFields(el: Linkable, table: ChartTable): object | null {
  const picked = pickSeries(table, el.chartSheetSource?.series);
  if (isLiveTable(el))
    return liveTablePatch(el, tableCellsFromRead(picked, labelHeading(el.chartSheetSource)));
  const fields = chartFieldsFromTable(el, picked);
  return sameChartData(el, fields) ? null : fields;
}

// What the From a Plan preview shows of a read: the categories and the series the element draws, as Link would write
// them (a scatter may take the first column as its x), and how many series a pie or bar leaves out, since it draws
// the first alone (Work Tracker 1212). A table draws every series.
export function drawnTable(
  el: Linkable,
  table: ChartTable,
): { table: ChartTable; leftOut: number } {
  if (isLiveTable(el)) return { table, leftOut: 0 };
  const fields = chartFieldsFromTable(el, table);
  if ('pieSlices' in fields)
    return {
      table: { categories: table.categories, series: table.series.slice(0, 1) },
      leftOut: Math.max(0, table.series.length - 1),
    };
  return {
    table: {
      categories: fields.lineCategories,
      series: fields.lineSeries.map((s) => ({ name: s.name, values: s.values })),
    },
    leftOut: 0,
  };
}

// The link as a read leaves it: the names, and for a range its A1 and the ids it reads now, and when.
export function sourceAfterRead(s: ChartSheetSource, read: LiveRead): ChartSheetSource {
  if (isRangeSource(s) && 'sheetName' in read)
    return {
      ...s,
      itemName: read.itemName,
      sheetName: read.sheetName,
      range: read.range,
      a1: read.a1,
      readAt: read.readAt,
    };
  if (!isRangeSource(s) && 'sourceName' in read)
    return {
      ...s,
      itemName: read.itemName,
      sourceName: read.sourceName,
      label: read.label,
      readAt: read.readAt,
    };
  return { ...s, itemName: read.itemName, readAt: read.readAt };
}

// Whether a chart already stores what a read gives it.
export function sameChartData(
  el: SheetChartFields,
  fields: ReturnType<typeof chartFieldsFromTable>,
): boolean {
  if ('pieSlices' in fields)
    return JSON.stringify(el.pieSlices ?? []) === JSON.stringify(fields.pieSlices);
  return (
    JSON.stringify(el.lineCategories ?? []) === JSON.stringify(fields.lineCategories) &&
    JSON.stringify(el.lineSeries ?? []) === JSON.stringify(fields.lineSeries)
  );
}

// The names a link shows, per kind.
const namesOf = (s: ChartSheetSource) =>
  isRangeSource(s) ? [s.itemName, s.sheetName, s.a1] : [s.itemName, s.sourceName, s.label];

// Whether a stored link names the same source and names as a read would leave it.
export function sameSource(a: ChartSheetSource, b: ChartSheetSource): boolean {
  return (
    sheetLinkKey(a) === sheetLinkKey(b) && JSON.stringify(namesOf(a)) === JSON.stringify(namesOf(b))
  );
}

// The element a person sees: a live read's values over the saved ones (the store is not changed by this).
export function chartAsSeen<E extends Linkable>(el: E, status: SheetLinkStatus | undefined): E {
  if (status?.kind !== 'live') return el;
  const fields = liveFields(el, status.read.table);
  return fields ? { ...el, ...fields } : el;
}

// "updated 2 min ago" for a live read, "saved 2 hours ago" for values this person cannot refresh.
export function linkedAgo(readAt: number, now: number): string {
  return formatRelativeTimeShort(Math.max(0, now - readAt));
}

// "12 Nov" (and the year when it is not this one): the day a frozen link's numbers are from.
export function frozenDay(readAt: number, now: number): string {
  const day = new Date(readAt);
  const sameYear = day.getFullYear() === new Date(now).getFullYear();
  return day.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export type SheetLinkTone = 'live' | 'quiet' | 'warn';

// The line a linked element shows below its bottom edge, and its Data section's status: "Live from <plan> · updated
// 2 min ago", or "From <plan> · …" when the numbers are not live for this person.
export function sheetLinkLine(
  s: ChartSheetSource,
  status: SheetLinkStatus | undefined,
  now: number,
): { lead: string; name: string; detail: string; tone: SheetLinkTone } {
  const name = s.itemName || 'a plan';
  if (s.frozen)
    return { lead: 'From', name, detail: `frozen ${frozenDay(s.readAt, now)}`, tone: 'quiet' };
  switch (status?.kind) {
    case 'live':
      return {
        lead: 'Live from',
        name,
        detail: `updated ${linkedAgo(status.read.readAt, now)}`,
        tone: 'live',
      };
    // Only a range breaks this way (a board or metric that is gone reads as not found, so as saved).
    case 'gone':
      return { lead: 'From', name, detail: 'The linked range is gone', tone: 'warn' };
    case 'failed':
      return {
        lead: 'From',
        name,
        detail: `Couldn't update, saved ${linkedAgo(s.readAt, now)}`,
        tone: 'warn',
      };
    default:
      return { lead: 'From', name, detail: `saved ${linkedAgo(s.readAt, now)}`, tone: 'quiet' };
  }
}
