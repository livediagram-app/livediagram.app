// Sheet sources (liveworkspace/docs/specs/004-index/sheet-sources.md): a chart in one app drawing from one range of a
// sheet in another, read on each reader's own access. The shapes every side shares: the index's routes, the sheet
// app's doors (@liveworkspace/index-app sheet-source-doors.ts, @liveworkspace/app-doors), and the reader's element.

import type { App } from './constants';

// The apps whose items hold sheets a chart may read, and the apps whose items may watch one.
export const SHEET_SOURCE_APPS = ['liveplanner'] as const satisfies readonly App[];
export type SheetSourceApp = (typeof SHEET_SOURCE_APPS)[number];
export const SOURCE_WATCH_APPS = [
  'livedocuments',
  'livediagram',
  'livedesign',
  'liveknowledge',
] as const satisfies readonly App[];
export type SourceWatchApp = (typeof SOURCE_WATCH_APPS)[number];

export const isSheetSourceApp = (value: unknown): value is SheetSourceApp =>
  (SHEET_SOURCE_APPS as readonly unknown[]).includes(value);
export const isSourceWatchApp = (value: unknown): value is SourceWatchApp =>
  (SOURCE_WATCH_APPS as readonly unknown[]).includes(value);

// A sheet's row or column id (liveplanner's AXIS_ID_PATTERN), and a sheet's own id.
export const SHEET_AXIS_ID = /^[a-z0-9]{4,12}$/;
const SHEET_ID = /^[A-Za-z0-9_-]{1,64}$/;
// The longest A1 range text taken (`AAA1048576:ZZZ1048576` is 21).
export const SHEET_A1_MAX = 24;
// The most columns an ask picks: the series cap and a label column.
export const SHEET_COLS_MAX = 13;
// One change signal's sheets and watchers.
export const SHEET_CHANGE_SHEETS_MAX = 50;
export const SHEET_WATCHERS_MAX = 20;

// A range by its corners' stable row and column ids.
export type SheetAxisRange = { r1: string; c1: string; r2: string; c2: string };

// What a read asks for: a sheet and its range, as ids or as A1 text (exactly one), and maybe some of its columns.
export type SheetRangeAsk = {
  sheetId: string;
  range?: SheetAxisRange;
  a1?: string;
  cols?: string[];
};

// What a range holds, as a chart reads it: one category per row, one series per value column.
export type SheetChartTable = {
  categories: string[];
  series: { name: string; values: number[] }[];
};

// One sheet of a source, for a picker: `a1` its filled extent (the range to offer first).
export type SheetListing = { id: string; name: string; tabId: string; a1: string };

// The door's read, and the index's: the range as ids now (an A1 asked for comes back as ids) and as A1 text.
export type SheetRangeDoorRead = {
  sheetName: string;
  tabId: string;
  range: SheetAxisRange;
  a1: string;
  table: SheetChartTable;
};
export type SheetRangeRead = SheetRangeDoorRead & {
  itemId: string;
  itemName: string;
  sheetId: string;
  // The index's clock when it answered, epoch ms.
  readAt: number;
};
export type SheetList = { itemId: string; itemName: string; sheets: SheetListing[] };

// What a reader app's door is told when a watched sheet changes: ids only, never values. A plan whose sent cards
// changed (send-to-plan.md "The chip") names them in `cards`, with `sheetIds` then empty.
export type SourceChange = {
  app: SheetSourceApp;
  itemId: string;
  sheetIds: string[];
  cards?: string[];
};

// The most cards one change names (send-to-plan.md, PLAN_CARDS_CHANGED_MAX).
const SOURCE_CHANGE_CARDS_MAX = 100;
const CARD_ID = /^[A-Za-z0-9_-]{1,200}$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isSheetId = (v: unknown): v is string => typeof v === 'string' && SHEET_ID.test(v);

export function isSheetAxisRange(v: unknown): v is SheetAxisRange {
  if (!isRecord(v)) return false;
  return [v.r1, v.c1, v.r2, v.c2].every((id) => typeof id === 'string' && SHEET_AXIS_ID.test(id));
}

const isCols = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.length <= SHEET_COLS_MAX &&
  new Set(v).size === v.length &&
  v.every((id) => typeof id === 'string' && SHEET_AXIS_ID.test(id));

// An ask from a request body, or null for a malformed one. Fields besides these are ignored.
export function readSheetRangeAsk(raw: unknown): SheetRangeAsk | null {
  if (!isRecord(raw) || !isSheetId(raw.sheetId)) return null;
  const { range, a1, cols } = raw;
  const hasRange = range !== undefined;
  const hasA1 = a1 !== undefined;
  if (hasRange === hasA1) return null;
  if (hasRange && !isSheetAxisRange(range)) return null;
  if (hasA1 && (typeof a1 !== 'string' || a1.trim() === '' || a1.length > SHEET_A1_MAX)) {
    return null;
  }
  if (cols !== undefined && !isCols(cols)) return null;
  return {
    sheetId: raw.sheetId,
    ...(hasRange ? { range: pickRange(range as SheetAxisRange) } : { a1: (a1 as string).trim() }),
    ...(cols ? { cols: [...cols] } : {}),
  };
}

const pickRange = ({ r1, c1, r2, c2 }: SheetAxisRange): SheetAxisRange => ({ r1, c1, r2, c2 });

// A table from an answer, checked: text categories, named series of finite numbers.
export function isSheetChartTable(v: unknown): v is SheetChartTable {
  if (!isRecord(v) || !Array.isArray(v.categories) || !Array.isArray(v.series)) return false;
  return (
    v.categories.every((c) => typeof c === 'string') &&
    v.series.every(
      (s) =>
        isRecord(s) &&
        typeof s.name === 'string' &&
        Array.isArray(s.values) &&
        s.values.every((n) => typeof n === 'number' && Number.isFinite(n)),
    )
  );
}

// A door's read, checked field by field (a malformed answer is the door's failure).
export function isSheetRangeDoorRead(v: unknown): v is SheetRangeDoorRead {
  return (
    isRecord(v) &&
    typeof v.sheetName === 'string' &&
    typeof v.tabId === 'string' &&
    isSheetAxisRange(v.range) &&
    typeof v.a1 === 'string' &&
    isSheetChartTable(v.table)
  );
}

export function isSheetListing(v: unknown): v is SheetListing {
  return (
    isRecord(v) &&
    isSheetId(v.id) &&
    typeof v.name === 'string' &&
    typeof v.tabId === 'string' &&
    typeof v.a1 === 'string'
  );
}

// A change from a door's body, or null.
export function readSourceChange(raw: unknown): SourceChange | null {
  if (!isRecord(raw) || !isSheetSourceApp(raw.app) || !isSheetId(raw.itemId)) return null;
  const { sheetIds, cards } = raw;
  if (
    !Array.isArray(sheetIds) ||
    sheetIds.length > SHEET_CHANGE_SHEETS_MAX ||
    !sheetIds.every(isSheetId)
  ) {
    return null;
  }
  const cardIds =
    cards === undefined
      ? []
      : Array.isArray(cards) &&
          cards.length <= SOURCE_CHANGE_CARDS_MAX &&
          cards.every((c) => typeof c === 'string' && CARD_ID.test(c))
        ? (cards as string[])
        : null;
  if (cardIds === null || (sheetIds.length === 0 && cardIds.length === 0)) return null;
  return {
    app: raw.app,
    itemId: raw.itemId,
    sheetIds: [...new Set(sheetIds)],
    ...(cardIds.length > 0 ? { cards: [...new Set(cardIds)] } : {}),
  };
}
