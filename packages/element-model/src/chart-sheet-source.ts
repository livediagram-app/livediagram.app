// A chart or table linked to a liveplanner plan (liveworkspace/docs/specs/004-index/live-data.md; sheet-sources.md;
// each product's docs/specs/009-elements/pie-chart.md "Live data from a plan"): what of the plan is read (a Sheet range,
// a board's counts or a Dashboard metric), with the names and the time of the last read the element's saved values came
// from, which of the read's series feed it, and whether it is frozen. The element's own data fields are that read, so a
// reader who cannot open the plan, an export and a Community copy still draw it. Pure, and free of the index client (its
// guards are restated here).

type LinkCommon = {
  app: 'liveplanner';
  // The plan's index item id.
  itemId: string;
  // As the last read named it: shown on the live line while the plan cannot be read.
  itemName: string;
  // When the saved values were read (ms since the epoch).
  readAt: number;
  // The read's series that feed the element, by index, in order; every series when absent.
  series?: number[];
  // Freeze: the numbers kept as they are, never read again until Unfreeze.
  frozen?: true;
};

// A Sheet range (sheet-sources.md): every link made before live data has no `kind`.
export type ChartRangeSource = LinkCommon & {
  kind?: 'sheet';
  sheetId: string;
  range: { r1: string; c1: string; r2: string; c2: string };
  // Only these of the range's columns, by id; every column when absent.
  cols?: string[];
  sheetName: string;
  a1: string;
};

export const BOARD_COUNT_BY = ['column', 'label', 'assignee', 'priority'] as const;
export type LinkBoardCountBy = (typeof BOARD_COUNT_BY)[number];
const FILTER_KEYS = ['priority', 'label', 'person', 'type'] as const;

// A board's cards counted (live-data.md "Reading a board or a metric").
export type ChartBoardSource = LinkCommon & {
  kind: 'board';
  boardId: string;
  by: LinkBoardCountBy;
  filter?: Partial<Record<(typeof FILTER_KEYS)[number], string>>;
  // The board's name and the words for what is read, as last read.
  sourceName: string;
  label: string;
};

// One of the plan's Dashboard metrics.
export type ChartMetricSource = LinkCommon & {
  kind: 'metric';
  metric: string;
  sourceName: string;
  label: string;
};

// The stored link, by its first name for every kind.
export type ChartSheetSource = ChartRangeSource | ChartBoardSource | ChartMetricSource;
export type LiveSourceKind = 'sheet' | 'board' | 'metric';

export const sourceKindOf = (s: ChartSheetSource): LiveSourceKind => s.kind ?? 'sheet';
export const isRangeSource = (s: ChartSheetSource): s is ChartRangeSource =>
  sourceKindOf(s) === 'sheet';

// The index's item and sheet id shape, a sheet's row or column id, and the caps (@liveworkspace/index-client
// sheet-sources.ts, live-data.ts).
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const AXIS_ID = /^[a-z0-9]{4,12}$/;
const METRIC_ID = /^[a-z-]{1,32}$/;
const COLS_MAX = 13;
const A1_MAX = 24;
export const SHEET_SOURCE_NAME_MAX = 200;
const LABEL_MAX = 80;
const FILTER_VALUE_MAX = 64;
// The most series a read gives (the chart cap).
export const LIVE_SERIES_MAX = 12;

const isName = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function commonValid(v: Record<string, unknown>): boolean {
  const { app, itemId, itemName, readAt, series, frozen } = v;
  if (app !== 'liveplanner' || typeof itemId !== 'string' || !ITEM_ID.test(itemId)) return false;
  if (!isName(itemName, SHEET_SOURCE_NAME_MAX)) return false;
  if (typeof readAt !== 'number' || !Number.isFinite(readAt) || readAt < 0) return false;
  if (frozen !== undefined && frozen !== true) return false;
  return (
    series === undefined ||
    (Array.isArray(series) &&
      series.length > 0 &&
      series.length <= LIVE_SERIES_MAX &&
      new Set(series).size === series.length &&
      series.every((i) => Number.isInteger(i) && i >= 0 && i < LIVE_SERIES_MAX))
  );
}

const COMMON = ['app', 'itemId', 'itemName', 'readAt', 'series', 'frozen'];
const onlyKeys = (v: Record<string, unknown>, own: readonly string[]) =>
  Object.keys(v).every((k) => COMMON.includes(k) || own.includes(k));

function rangeValid(v: Record<string, unknown>): boolean {
  const { sheetId, range, cols, sheetName, a1 } = v;
  if (!onlyKeys(v, ['kind', 'sheetId', 'range', 'cols', 'sheetName', 'a1'])) return false;
  if (typeof sheetId !== 'string' || !ITEM_ID.test(sheetId)) return false;
  if (!isName(sheetName, SHEET_SOURCE_NAME_MAX) || !isName(a1, A1_MAX)) return false;
  if (
    cols !== undefined &&
    !(
      Array.isArray(cols) &&
      cols.length > 0 &&
      cols.length <= COLS_MAX &&
      new Set(cols).size === cols.length &&
      cols.every((id) => typeof id === 'string' && AXIS_ID.test(id))
    )
  )
    return false;
  if (!isRecord(range)) return false;
  const { r1, c1, r2, c2, ...more } = range;
  return (
    Object.keys(more).length === 0 &&
    [r1, c1, r2, c2].every((id) => typeof id === 'string' && AXIS_ID.test(id))
  );
}

const namesValid = (v: Record<string, unknown>) =>
  isName(v.sourceName, SHEET_SOURCE_NAME_MAX) && isName(v.label, LABEL_MAX);

function boardValid(v: Record<string, unknown>): boolean {
  const { boardId, by, filter } = v;
  if (!onlyKeys(v, ['kind', 'boardId', 'by', 'filter', 'sourceName', 'label'])) return false;
  if (typeof boardId !== 'string' || !ITEM_ID.test(boardId)) return false;
  if (!(BOARD_COUNT_BY as readonly unknown[]).includes(by) || !namesValid(v)) return false;
  return (
    filter === undefined ||
    (isRecord(filter) &&
      Object.entries(filter).every(
        ([k, x]) =>
          (FILTER_KEYS as readonly string[]).includes(k) &&
          typeof x === 'string' &&
          x.length > 0 &&
          x.length <= FILTER_VALUE_MAX,
      ))
  );
}

function metricValid(v: Record<string, unknown>): boolean {
  if (!onlyKeys(v, ['kind', 'metric', 'sourceName', 'label'])) return false;
  return typeof v.metric === 'string' && METRIC_ID.test(v.metric) && namesValid(v);
}

export function isChartSheetSource(v: unknown): v is ChartSheetSource {
  if (!isRecord(v) || !commonValid(v)) return false;
  if (v.kind === undefined || v.kind === 'sheet') return rangeValid(v);
  if (v.kind === 'board') return boardValid(v);
  if (v.kind === 'metric') return metricValid(v);
  return false;
}

// Where the link reads from, in words: "Budget · B2:E9", "Roadmap · Cards per column", "Dashboard · Completion".
export function liveSourceWhat(s: ChartSheetSource): { name: string; detail: string } {
  if (isRangeSource(s)) return { name: s.sheetName || 'Sheet', detail: s.a1 };
  return { name: s.sourceName || (s.kind === 'board' ? 'Board' : 'Dashboard'), detail: s.label };
}

// Elements with every link dropped and its saved values kept: what an export and a Community copy carry, so they
// freeze the values and never name a plan their reader may not open. The same array when nothing is linked.
export function withoutSheetSources<E extends object>(elements: readonly E[]): E[] {
  if (!elements.some((el) => 'chartSheetSource' in el)) return elements as E[];
  return elements.map((el) => {
    if (!('chartSheetSource' in el)) return el;
    const { chartSheetSource: _gone, ...kept } = el as E & { chartSheetSource?: unknown };
    return kept as E;
  });
}
