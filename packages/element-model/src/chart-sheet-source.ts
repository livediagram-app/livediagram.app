// A chart linked to a liveplanner sheet (livedocuments docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"; liveworkspace/docs/specs/004-index/sheet-sources.md): the plan, the Sheet and the range by stable
// row and column ids, with the names and the time of the last read the chart's saved values came from. The chart's own
// data fields are that read, so a reader who cannot open the Sheet, an export and a Community copy still draw it.
// Pure, and free of the index client (its guards are restated here).

export type ChartSheetSource = {
  app: 'liveplanner';
  // The plan's index item id.
  itemId: string;
  sheetId: string;
  range: { r1: string; c1: string; r2: string; c2: string };
  // Only these of the range's columns, by id; every column when absent.
  cols?: string[];
  // As the last read named them: shown on the "Linked to" line while the plan cannot be read.
  itemName: string;
  sheetName: string;
  a1: string;
  // When the saved values were read (ms since the epoch).
  readAt: number;
};

// The index's item and sheet id shape, a sheet's row or column id, and the caps (@liveworkspace/index-client
// sheet-sources.ts).
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const AXIS_ID = /^[a-z0-9]{4,12}$/;
const COLS_MAX = 13;
const A1_MAX = 24;
export const SHEET_SOURCE_NAME_MAX = 200;

const isName = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

export function isChartSheetSource(v: unknown): v is ChartSheetSource {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const { app, itemId, sheetId, range, cols, itemName, sheetName, a1, readAt, ...rest } =
    v as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || app !== 'liveplanner') return false;
  if (typeof itemId !== 'string' || !ITEM_ID.test(itemId)) return false;
  if (typeof sheetId !== 'string' || !ITEM_ID.test(sheetId)) return false;
  if (!isName(itemName, SHEET_SOURCE_NAME_MAX) || !isName(sheetName, SHEET_SOURCE_NAME_MAX))
    return false;
  if (!isName(a1, A1_MAX)) return false;
  if (typeof readAt !== 'number' || !Number.isFinite(readAt) || readAt < 0) return false;
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
  if (typeof range !== 'object' || range === null) return false;
  const { r1, c1, r2, c2, ...more } = range as Record<string, unknown>;
  return (
    Object.keys(more).length === 0 &&
    [r1, c1, r2, c2].every((id) => typeof id === 'string' && AXIS_ID.test(id))
  );
}

// Elements with every chart's link dropped and its saved values kept: what an export and a Community copy carry, so
// they freeze the values and never name a plan their reader may not open. The same array when nothing is linked.
export function withoutSheetSources<E extends object>(elements: readonly E[]): E[] {
  if (!elements.some((el) => 'chartSheetSource' in el)) return elements as E[];
  return elements.map((el) => {
    if (!('chartSheetSource' in el)) return el;
    const { chartSheetSource: _gone, ...kept } = el as E & { chartSheetSource?: unknown };
    return kept as E;
  });
}
