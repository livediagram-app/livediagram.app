// The Plan board set-up and its projection (docs/specs/025-plan/plan-board.md).
// The board stores only its set-up; what it shows is computed here from the
// item store, so every board (and the api's tab scoping) reads items the same way.

import type { Item, ItemPerson } from './item';
import { itemAssignee, itemLabels, itemStatus, itemTitle } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { PRIORITIES, PRIORITY_LABELS, isPriority } from './fields';
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
}

export const SWIMLANE_BY = ['none', 'assignee', 'type', 'priority', 'parent'] as const;
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
] as const;
export type CardField = (typeof CARD_FIELDS)[number];

export interface PlanBoardSetup {
  title: string;
  columns: PlanColumn[];
  doneColumnId?: string;
  swimlaneBy: SwimlaneBy;
  cardFields: CardField[];
  voting: { on: boolean; budget?: number };
  hideWriting: boolean;
}

export interface QuickFilter {
  text?: string;
  // Only items assigned to this person id.
  mine?: string;
}

export interface LaneHead {
  key: string;
  label: string;
  // What a drop into this lane sets (null clears the field).
  field: 'assignee' | 'type' | 'priority' | 'parent' | null;
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

export function quickFilterMatches(quick: QuickFilter | undefined, item: Item): boolean {
  if (!quick) return true;
  if (quick.mine && itemAssignee(item)?.id !== quick.mine) return false;
  const text = quick.text?.trim().toLowerCase();
  if (text) {
    const hay = [itemTitle(item), `#${item.key}`, ...itemLabels(item)].join(' ').toLowerCase();
    if (!hay.includes(text)) return false;
  }
  return true;
}

function laneOf(
  by: SwimlaneBy,
  item: Item,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LaneHead {
  switch (by) {
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
): (a: LaneHead, b: LaneHead) => number {
  return (a, b) => {
    if (a.key === NO_LANE) return b.key === NO_LANE ? 0 : 1;
    if (b.key === NO_LANE) return -1;
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
): BoardProjection {
  const byStatus = new Map<string, PlanColumn>(setup.columns.map((c) => [c.status, c]));
  const scoped: Item[] = [];
  const unplaced: Item[] = [];
  for (const it of items.values()) {
    const status = itemStatus(it);
    if (status === undefined || !byStatus.has(status)) unplaced.push(it);
    else scoped.push(it);
  }
  scoped.sort(byRank);
  unplaced.sort((a, b) => a.key - b.key);

  const laneMap = new Map<string, LaneHead>();
  const laneOfItem = new Map<string, string>();
  for (const it of scoped) {
    const lane = laneOf(setup.swimlaneBy, it, items, types);
    if (!laneMap.has(lane.key)) laneMap.set(lane.key, lane);
    laneOfItem.set(it.id, lane.key);
  }
  // A board with swimlanes always offers the empty group as a drop target.
  if (setup.swimlaneBy !== 'none' && setup.swimlaneBy !== 'type' && !laneMap.has(NO_LANE)) {
    laneMap.set(NO_LANE, laneOf(setup.swimlaneBy, { fields: {} } as Item, items, types));
  }
  if (laneMap.size === 0) laneMap.set(NO_LANE, laneOf('none', scoped[0]!, items, types));
  const lanes = [...laneMap.values()].sort(laneSort(setup.swimlaneBy, items, types));

  let doneCount = 0;
  const doneStatus = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
  const columns: ProjectedColumn[] = setup.columns.map((column) => {
    const all = scoped.filter((it) => itemStatus(it) === column.status);
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
    columns.push(col);
  }
  if (columns.length === 0) return null;
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
