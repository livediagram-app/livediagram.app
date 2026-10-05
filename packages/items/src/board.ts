// The Plan board set-up and its projection (docs/specs/025-plan/plan-board.md).
// The board stores only its set-up; what it shows is computed here from the
// item store, so every board (and the api's tab scoping) reads items the same way.

import { ITEM_TYPE_PATTERN } from './limits';
import { readBoardWidgets, type BoardWidgetKind } from './board-widgets';
import type { Item, ItemPerson } from './item';
import { itemAssignee, itemLabels, itemStatus, itemTitle } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { PRIORITIES, PRIORITY_LABELS, isPriority, type Priority } from './fields';
import { byRank } from './apply';
import {
  ITEM_STATUS_MAX,
  PLAN_COLUMNS_MAX,
  PLAN_COLUMN_NAME_MAX,
  PLAN_TITLE_MAX,
  PLAN_VOTE_BUDGET_MAX,
  PLAN_WIP_MAX,
} from './limits';

export interface PlanColumn {
  id: string;
  status: string;
  name: string;
  wipLimit?: number;
  color?: string;
  // How many slots wide it is (docs/specs/025-plan/plan-board.md "The board set-up"); absent is 1.
  width?: ColumnWidth;
}

export const COLUMN_WIDTHS = [1, 2, 3] as const;
export type ColumnWidth = (typeof COLUMN_WIDTHS)[number];

export const SWIMLANE_BY = ['none', 'assignee', 'type', 'priority', 'parent', 'status'] as const;
export type SwimlaneBy = (typeof SWIMLANE_BY)[number];

export const CARD_FIELDS = [
  'key',
  'type',
  'assignee',
  'priority',
  'labels',
  'estimate',
  'due',
  'votes',
  'checklist',
  // A Detailed card's extras: two lines of its description, and the project it sits under.
  'description',
  'parent',
] as const;
export type CardField = (typeof CARD_FIELDS)[number];

// How much of each card a board draws (docs/specs/025-plan/plan-board.md "The board set-up"): the title
// only, one line, or every field it shows. Absent is Detailed.
export const CARD_SIZES = ['minimal', 'compact', 'detailed'] as const;
export type CardSize = (typeof CARD_SIZES)[number];

// The fields each card size can draw (docs/specs/025-plan/plan-board.md "The board set-up"): a field the
// board shows outside its size's set is kept but not drawn, and its tile in the Cards menu says so.
export const CARD_SIZE_FIELDS: Readonly<Record<CardSize, readonly CardField[]>> = {
  minimal: [],
  compact: ['key', 'type', 'assignee', 'priority', 'due', 'votes'],
  detailed: CARD_FIELDS,
};

// What a card at this size draws of the fields its board shows.
export function cardFieldsAt(
  size: CardSize | undefined,
  fields: readonly CardField[],
): CardField[] {
  const allowed = CARD_SIZE_FIELDS[size ?? 'detailed'];
  return fields.filter((f) => allowed.includes(f));
}

export interface PlanBoardSetup {
  title: string;
  columns: PlanColumn[];
  doneColumnId?: string;
  swimlaneBy: SwimlaneBy;
  cardFields: CardField[];
  cardSize?: CardSize;
  // An Archive board (docs/specs/025-plan/items.md "Archive"): it shows only archived items.
  archive?: boolean;
  // An All Cards board (docs/specs/025-plan/plan-board.md "All Cards"): every card, whatever its status.
  allCards?: boolean;
  // The card types Add Card and the palette add to it (docs/specs/025-plan/plan-board.md "The board set-up");
  // absent is every type. It shows any card that reaches it.
  addTypes?: string[];
  // The header's widgets in order (docs/specs/025-plan/board-widgets.md); absent is the default set.
  widgets?: BoardWidgetKind[];
  voting: { on: boolean; budget?: number };
  hideWriting: boolean;
}

// The Due Soon widget's narrowing: due from `from` (absent: any earlier day) to `to`, not done.
export interface QuickDueWindow {
  from?: string;
  to: string;
  doneStatus?: string;
}

export interface QuickFilter {
  text?: string;
  // Only items assigned to this person id.
  mine?: string;
  // From the board's widgets (docs/specs/025-plan/board-widgets.md): only items assigned to this person
  // id, only items of this type, only items due within a window of days (YYYY-MM-DD, both ends
  // included) and not in the board's done status.
  person?: string;
  type?: string;
  due?: QuickDueWindow;
  // Only items of this priority.
  priority?: Priority;
}

// `QuickFilter.person` for the cards nobody is assigned.
export const UNASSIGNED = '-';

// An archived item (docs/specs/025-plan/items.md "Archive"): off every board but an Archive board.
export function isArchived(item: Item): boolean {
  return item.fields['archived'] === true;
}

// The Trash (docs/specs/025-plan/items.md "Trash"): a status no board shows. A trashed item keeps the status
// it had under `trashedFrom`, so it can be restored to it.
export const TRASH_STATUS = 'trash';
export const TRASHED_FROM_FIELD = 'trashedFrom';

export function isTrashed(item: Item): boolean {
  return itemStatus(item) === TRASH_STATUS;
}

export interface LaneHead {
  key: string;
  label: string;
  // What a drop into this lane sets (null clears the field).
  field: 'assignee' | 'type' | 'priority' | 'parent' | 'status' | null;
  value: Item['fields'][string] | null;
  person?: ItemPerson;
}

export interface ProjectedColumn {
  column: PlanColumn;
  count: number;
  overLimit: boolean;
  // One entry per board lane (a single '' lane with no swimlanes).
  lanes: { laneKey: string; items: Item[] }[];
}

export interface BoardProjection {
  columns: ProjectedColumn[];
  lanes: LaneHead[];
  unplaced: Item[];
  doneCount: number;
  total: number;
}

export const NO_LANE = '';

// A column's narrowest on screen, per slot, and the board's gaps and side padding around its columns.
export const PLAN_COLUMN_MIN_PX = 220;
const PLAN_COLUMN_GAP_PX = 12;
const PLAN_BOARD_SIDE_PAD_PX = 12;
// The default board width, for a board with few or no columns.
const PLAN_BOARD_MIN_WIDTH_PX = 760;

// How wide a board has to be for its columns to sit side by side without scrolling (docs/specs/025-plan/
// plan-board.md "The board set-up"): what a board placed from the palette starts at, at least.
export function planBoardWidthFor(setup: Pick<PlanBoardSetup, 'columns'>): number {
  const slots = setup.columns.reduce((n, c) => n + (c.width ?? 1), 0);
  const gaps = Math.max(0, setup.columns.length - 1) * PLAN_COLUMN_GAP_PX;
  return Math.max(
    PLAN_BOARD_MIN_WIDTH_PX,
    slots * PLAN_COLUMN_MIN_PX + gaps + PLAN_BOARD_SIDE_PAD_PX * 2 + 8,
  );
}

// The add types a board names: type ids, each once, at most 32.
function readAddTypes(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: string[] = [];
  for (const t of input)
    if (typeof t === 'string' && ITEM_TYPE_PATTERN.test(t) && !out.includes(t)) out.push(t);
  return out.slice(0, 32);
}

// The types a board takes new cards of, in the catalogue's order: its own, or every one.
export function boardAddTypes<T extends { id: string }>(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly T[],
): T[] {
  if (!setup.addTypes) return [...types];
  return types.filter((t) => setup.addTypes!.includes(t.id));
}

export function quickFilterMatches(quick: QuickFilter | undefined, item: Item): boolean {
  if (!quick) return true;
  if (quick.mine && itemAssignee(item)?.id !== quick.mine) return false;
  if (quick.person && (itemAssignee(item)?.id ?? UNASSIGNED) !== quick.person) return false;
  if (quick.priority && item.fields['priority'] !== quick.priority) return false;
  if (quick.type && item.type !== quick.type) return false;
  if (quick.due) {
    const due = item.fields['due'];
    if (typeof due !== 'string' || due > quick.due.to) return false;
    if (quick.due.from && due < quick.due.from) return false;
    if (quick.due.doneStatus && itemStatus(item) === quick.due.doneStatus) return false;
  }
  const text = quick.text?.trim().toLowerCase();
  if (text) {
    const hay = [itemTitle(item), `#${item.key}`, ...itemLabels(item)].join(' ').toLowerCase();
    if (!hay.includes(text)) return false;
  }
  return true;
}

// A status as people read it (docs/specs/025-plan/plan-board.md "All Cards"): the name a column gives it,
// else the status itself without a new board's suffix, words capitalised.
export function statusLabel(status: string, names?: ReadonlyMap<string, string>): string {
  const named = names?.get(status);
  if (named) return named;
  const words = status.split('~')[0]!.replace(/[-_]+/g, ' ').trim();
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : status;
}

function laneOf(
  by: SwimlaneBy,
  item: Item,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): LaneHead {
  switch (by) {
    case 'status': {
      const s = itemStatus(item);
      return s
        ? { key: `s:${s}`, label: statusLabel(s, statusNames), field: 'status', value: s }
        : { key: NO_LANE, label: 'No status', field: 'status', value: null };
    }
    case 'none':
      return { key: NO_LANE, label: '', field: null, value: null };
    case 'assignee': {
      const p = itemAssignee(item);
      return p
        ? { key: `a:${p.id}`, label: p.name, field: 'assignee', value: { ...p }, person: p }
        : { key: NO_LANE, label: 'No assignee', field: 'assignee', value: null };
    }
    case 'type': {
      const def = types.find((t) => t.id === item.type);
      return {
        key: `t:${item.type}`,
        label: def?.label ?? item.type,
        field: 'type',
        value: item.type,
      };
    }
    case 'priority': {
      const p = item.fields['priority'];
      return isPriority(p)
        ? { key: `p:${p}`, label: PRIORITY_LABELS[p], field: 'priority', value: p }
        : { key: NO_LANE, label: 'No priority', field: 'priority', value: null };
    }
    case 'parent': {
      const id = item.fields['parent'];
      const parent = typeof id === 'string' ? items.get(id) : undefined;
      return parent
        ? { key: `e:${parent.id}`, label: itemTitle(parent), field: 'parent', value: parent.id }
        : { key: NO_LANE, label: 'No parent', field: 'parent', value: null };
    }
  }
}

function laneSort(
  by: SwimlaneBy,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): (a: LaneHead, b: LaneHead) => number {
  const order = [...(statusNames?.keys() ?? [])];
  return (a, b) => {
    if (a.key === NO_LANE) return b.key === NO_LANE ? 0 : 1;
    if (b.key === NO_LANE) return -1;
    // Statuses in the order the tab's boards name them, then any other by name.
    if (by === 'status') {
      const ia = order.indexOf(a.value as string);
      const ib = order.indexOf(b.value as string);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.label.localeCompare(b.label);
    }
    if (by === 'type') {
      const ia = types.findIndex((t) => `t:${t.id}` === a.key);
      const ib = types.findIndex((t) => `t:${t.id}` === b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.label.localeCompare(b.label);
    }
    if (by === 'priority') {
      return PRIORITIES.indexOf(a.value as never) - PRIORITIES.indexOf(b.value as never);
    }
    if (by === 'parent') {
      return (items.get(a.value as string)?.key ?? 0) - (items.get(b.value as string)?.key ?? 0);
    }
    return a.label.localeCompare(b.label);
  };
}

export function projectBoard(
  setup: PlanBoardSetup,
  items: ReadonlyMap<string, Item>,
  quick?: QuickFilter,
  // The document's type catalogue (docs/specs/025-plan/item-types.md): the order and names of type rows.
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  // Status names from the tab's boards' columns, in order: an All Cards board's status rows.
  statusNames?: ReadonlyMap<string, string>,
): BoardProjection {
  const byStatus = new Map<string, PlanColumn>(setup.columns.map((c) => [c.status, c]));
  const scoped: Item[] = [];
  const unplaced: Item[] = [];
  // An Archive board shows the archived items, every one in its first column; any other board leaves
  // them out altogether.
  const archiveBoard = setup.archive === true;
  // An All Cards board (docs/specs/025-plan/plan-board.md "All Cards") shows every card that is not
  // archived, whatever its status, in its one column.
  const allBoard = setup.allCards === true && !archiveBoard;
  for (const it of items.values()) {
    if (isTrashed(it)) continue;
    if (isArchived(it) !== archiveBoard) continue;
    if (archiveBoard || allBoard) {
      scoped.push(it);
      continue;
    }
    const status = itemStatus(it);
    if (status === undefined || !byStatus.has(status)) unplaced.push(it);
    else scoped.push(it);
  }
  scoped.sort(byRank);
  unplaced.sort((a, b) => a.key - b.key);

  const laneMap = new Map<string, LaneHead>();
  const laneOfItem = new Map<string, string>();
  for (const it of scoped) {
    const lane = laneOf(setup.swimlaneBy, it, items, types, statusNames);
    if (!laneMap.has(lane.key)) laneMap.set(lane.key, lane);
    laneOfItem.set(it.id, lane.key);
  }
  // A board with swimlanes always offers the empty group as a drop target.
  if (
    setup.swimlaneBy !== 'none' &&
    setup.swimlaneBy !== 'type' &&
    setup.swimlaneBy !== 'status' &&
    !laneMap.has(NO_LANE)
  ) {
    laneMap.set(
      NO_LANE,
      laneOf(setup.swimlaneBy, { fields: {} } as Item, items, types, statusNames),
    );
  }
  // Status rows include every status the tab's boards name, so a card can be dropped into an empty one.
  if (setup.swimlaneBy === 'status') {
    for (const [status, name] of statusNames ?? []) {
      if (!laneMap.has(`s:${status}`))
        laneMap.set(`s:${status}`, {
          key: `s:${status}`,
          label: name,
          field: 'status',
          value: status,
        });
    }
  }
  // No rows yet: the board's own empty row ("No status" on a status board), never a nameless one.
  if (laneMap.size === 0)
    laneMap.set(
      NO_LANE,
      laneOf(setup.swimlaneBy, { fields: {} } as Item, items, types, statusNames),
    );
  const lanes = [...laneMap.values()].sort(laneSort(setup.swimlaneBy, items, types, statusNames));

  let doneCount = 0;
  const doneStatus = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
  const columns: ProjectedColumn[] = setup.columns.map((column) => {
    const all =
      archiveBoard || allBoard
        ? column === setup.columns[0]
          ? scoped
          : []
        : scoped.filter((it) => itemStatus(it) === column.status);
    if (column.status === doneStatus) doneCount = all.length;
    const shown = all.filter((it) => quickFilterMatches(quick, it));
    return {
      column,
      count: all.length,
      overLimit: column.wipLimit !== undefined && all.length > column.wipLimit,
      lanes: lanes.map((l) => ({
        laneKey: l.key,
        items: shown.filter((it) => laneOfItem.get(it.id) === l.key),
      })),
    };
  });
  return { columns, lanes, unplaced, doneCount, total: scoped.length };
}

// Face-down while the board hides writing and the viewer did not write it.
export function cardIsFaceDown(
  item: Item,
  setup: Pick<PlanBoardSetup, 'hideWriting'>,
  viewerId: string,
): boolean {
  return setup.hideWriting && item.createdBy.id !== viewerId;
}

// Votes the viewer has spent on this board's items.
export function votesSpent(projection: BoardProjection, viewerId: string): number {
  let n = 0;
  for (const c of projection.columns)
    for (const l of c.lanes)
      for (const it of l.items) {
        const v = it.fields['votes'];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const mine = (v as Record<string, unknown>)[viewerId];
          if (typeof mine === 'number') n += mine;
        }
      }
  return n;
}

export type BoardSetupRejection = 'setup_invalid' | 'columns_invalid' | 'column_invalid';

const HEX = /^#[0-9a-fA-F]{6}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Validates a stored set-up; normalises it (drops a duplicate status, unknown
// card fields) so a set-up written by an agent never breaks a board.
export function normaliseBoardSetup(input: unknown): PlanBoardSetup | null {
  if (!isObj(input) || !Array.isArray(input['columns'])) return null;
  const seenIds = new Set<string>();
  const seenStatus = new Set<string>();
  const columns: PlanColumn[] = [];
  for (const c of input['columns'].slice(0, PLAN_COLUMNS_MAX)) {
    if (!isObj(c)) continue;
    const { id, status, name, wipLimit, color } = c;
    if (typeof id !== 'string' || !id || id.length > 40 || seenIds.has(id)) continue;
    if (typeof status !== 'string' || !status.trim() || status.length > ITEM_STATUS_MAX) continue;
    if (seenStatus.has(status)) continue;
    seenIds.add(id);
    seenStatus.add(status);
    const col: PlanColumn = {
      id,
      status,
      name: typeof name === 'string' && name.trim() ? name.slice(0, PLAN_COLUMN_NAME_MAX) : status,
    };
    if (
      typeof wipLimit === 'number' &&
      Number.isInteger(wipLimit) &&
      wipLimit >= 1 &&
      wipLimit <= PLAN_WIP_MAX
    ) {
      col.wipLimit = wipLimit;
    }
    if (typeof color === 'string' && HEX.test(color)) col.color = color;
    const width = (c as { width?: unknown }).width;
    if (width === 2 || width === 3) col.width = width;
    columns.push(col);
  }
  // No columns is a board waiting for its first (docs/specs/025-plan/plan-board.md "The board set-up").
  // Every board shows every card (docs/specs/025-plan/plan-board.md): a `scope` an older board stored is
  // read past.
  const votingIn = isObj(input['voting']) ? input['voting'] : {};
  const budget = votingIn['budget'];
  const swimlaneBy = (SWIMLANE_BY as readonly unknown[]).includes(input['swimlaneBy'])
    ? (input['swimlaneBy'] as SwimlaneBy)
    : 'none';
  const cardFields = Array.isArray(input['cardFields'])
    ? CARD_FIELDS.filter((f) => (input['cardFields'] as unknown[]).includes(f))
    : [...DEFAULT_CARD_FIELDS];
  const doneColumnId =
    typeof input['doneColumnId'] === 'string' && seenIds.has(input['doneColumnId'])
      ? input['doneColumnId']
      : undefined;
  return {
    title: typeof input['title'] === 'string' ? input['title'].slice(0, PLAN_TITLE_MAX) : 'Board',
    columns,
    ...(doneColumnId ? { doneColumnId } : {}),
    swimlaneBy,
    cardFields,
    ...(readBoardWidgets(input['widgets']) ? { widgets: readBoardWidgets(input['widgets']) } : {}),
    ...(input['archive'] === true ? { archive: true } : {}),
    ...(input['allCards'] === true ? { allCards: true } : {}),
    ...(readAddTypes(input['addTypes']) ? { addTypes: readAddTypes(input['addTypes']) } : {}),
    ...(input['cardSize'] === 'minimal' || input['cardSize'] === 'compact'
      ? { cardSize: input['cardSize'] }
      : {}),
    voting: {
      on: votingIn['on'] === true,
      ...(typeof budget === 'number' &&
      Number.isInteger(budget) &&
      budget >= 1 &&
      budget <= PLAN_VOTE_BUDGET_MAX
        ? { budget }
        : {}),
    },
    hideWriting: input['hideWriting'] === true,
  };
}

export const DEFAULT_CARD_FIELDS: readonly CardField[] = [
  'key',
  'type',
  'assignee',
  'priority',
  'labels',
  'checklist',
];

export function columnForStatus(
  setup: PlanBoardSetup,
  status: string | undefined,
): PlanColumn | undefined {
  return setup.columns.find((c) => c.status === status);
}
