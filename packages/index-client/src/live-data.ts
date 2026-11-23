// Live data (liveworkspace/docs/specs/004-index/live-data.md): a chart or table in one app counting a plan's board
// cards or showing one of its Dashboard metrics, read on each reader's own access, beside sheet sources
// (sheet-sources.ts). The shapes every side shares: the index's routes, the plan app's door and the reader's element.

import { isSheetChartTable, isSheetId, type SheetChartTable } from './sheet-sources';

// What a board's cards are counted by.
export const BOARD_COUNT_BYS = ['column', 'label', 'assignee', 'priority'] as const;
export type BoardCountBy = (typeof BOARD_COUNT_BYS)[number];
export const isBoardCountBy = (v: unknown): v is BoardCountBy =>
  (BOARD_COUNT_BYS as readonly unknown[]).includes(v);

// The words for each, as the dialog and the source line say them.
export const BOARD_COUNT_LABELS: Record<BoardCountBy, string> = {
  column: 'Cards per column',
  label: 'Cards per label',
  assignee: 'Cards per assignee',
  priority: 'Cards per priority',
};

// The cards a count takes: each part narrows them (a priority id, a label, a person's id, a card type's id).
export const BOARD_FILTER_KEYS = ['priority', 'label', 'person', 'type'] as const;
export type BoardCountFilter = Partial<Record<(typeof BOARD_FILTER_KEYS)[number], string>>;
const FILTER_VALUE_MAX = 64;

export type PlanDataAsk =
  | { kind: 'board'; boardId: string; by: BoardCountBy; filter?: BoardCountFilter }
  | { kind: 'metric'; metric: string };

// The watch id of every card-based source of a plan: a change to any card marks it.
export const PLAN_DATA_CARDS = 'cards';
// The longest list a listing gives: boards, and each filter's values.
export const PLAN_DATA_BOARDS_MAX = 50;
export const PLAN_DATA_LIST_MAX = 100;
const METRIC_ID = /^[a-z-]{1,32}$/;
const NAME_MAX = 200;

export type PlanDataBoard = { id: string; name: string; tabId: string };
export type PlanDataMetric = { id: string; label: string };
export type PlanDataFilters = {
  priorities: { id: string; label: string }[];
  labels: string[];
  people: { id: string; name: string }[];
  types: { id: string; label: string }[];
};
// The door's listing, and the index's (with the plan's id and name).
export type PlanDataDoorListing = {
  boards: PlanDataBoard[];
  metrics: PlanDataMetric[];
  filters: PlanDataFilters;
};
export type PlanDataListing = PlanDataDoorListing & { itemId: string; itemName: string };

// The door's read: the board's or Dashboard's name, its tab, the words for what was read, and the counts.
export type PlanDataDoorRead = {
  sourceName: string;
  tabId: string;
  label: string;
  table: SheetChartTable;
};
export type PlanDataRead = PlanDataDoorRead & {
  itemId: string;
  itemName: string;
  kind: PlanDataAsk['kind'];
  // The index's clock when it answered, epoch ms.
  readAt: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isShort = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

export const isMetricId = (v: unknown): v is string => typeof v === 'string' && METRIC_ID.test(v);

// A filter, checked: only the four keys, each a short string; null for a malformed one. An empty one is none.
export function readBoardCountFilter(v: unknown): BoardCountFilter | null | undefined {
  if (v === undefined) return undefined;
  if (!isRecord(v)) return null;
  const out: BoardCountFilter = {};
  for (const [key, value] of Object.entries(v)) {
    if (!(BOARD_FILTER_KEYS as readonly string[]).includes(key)) return null;
    if (!isShort(value, FILTER_VALUE_MAX)) return null;
    out[key as keyof BoardCountFilter] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// An ask from a request body, or null for a malformed one. Fields besides these are ignored.
export function readPlanDataAsk(raw: unknown): PlanDataAsk | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'metric')
    return isMetricId(raw.metric) ? { kind: 'metric', metric: raw.metric } : null;
  if (raw.kind !== 'board' || !isSheetId(raw.boardId) || !isBoardCountBy(raw.by)) return null;
  const filter = readBoardCountFilter(raw.filter);
  if (filter === null) return null;
  return { kind: 'board', boardId: raw.boardId, by: raw.by, ...(filter ? { filter } : {}) };
}

// A door's read, checked field by field (a malformed answer is the door's failure).
export function isPlanDataDoorRead(v: unknown): v is PlanDataDoorRead {
  return (
    isRecord(v) &&
    typeof v.sourceName === 'string' &&
    v.sourceName.length <= NAME_MAX &&
    typeof v.tabId === 'string' &&
    typeof v.label === 'string' &&
    v.label.length <= NAME_MAX &&
    isSheetChartTable(v.table)
  );
}

const isIdLabel = (key: 'label' | 'name') => (v: unknown) =>
  isRecord(v) && typeof v.id === 'string' && typeof v[key] === 'string';

const isCapped = (v: unknown, max: number, each: (x: unknown) => boolean): boolean =>
  Array.isArray(v) && v.length <= max && v.every(each);

// A door's listing, checked.
export function isPlanDataDoorListing(v: unknown): v is PlanDataDoorListing {
  if (!isRecord(v) || !isRecord(v.filters)) return false;
  const f = v.filters;
  return (
    isCapped(
      v.boards,
      PLAN_DATA_BOARDS_MAX,
      (b) =>
        isRecord(b) && isSheetId(b.id) && typeof b.name === 'string' && typeof b.tabId === 'string',
    ) &&
    isCapped(
      v.metrics,
      PLAN_DATA_LIST_MAX,
      (m) => isIdLabel('label')(m) && isMetricId((m as { id: unknown }).id),
    ) &&
    isCapped(f.priorities, PLAN_DATA_LIST_MAX, isIdLabel('label')) &&
    isCapped(f.labels, PLAN_DATA_LIST_MAX, (l) => typeof l === 'string') &&
    isCapped(f.people, PLAN_DATA_LIST_MAX, isIdLabel('name')) &&
    isCapped(f.types, PLAN_DATA_LIST_MAX, isIdLabel('label'))
  );
}
