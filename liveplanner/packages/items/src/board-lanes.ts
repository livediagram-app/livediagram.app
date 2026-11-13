// Items grouped into a board's swimlanes, and status names as people read them (docs/specs/026-plan/plan-board.md
// "Swimlanes"). board.ts re-exports the public ones.

import type { CardSearchFilter } from './card-search';
import type { Item } from './item';
import { itemAssignee, itemStatus } from './item';
import { statusTitleCase } from './status-title-case';
import type { IsDoneStatus } from './calculated-fields';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { PRIORITIES, PRIORITY_LABELS, isPriority } from './fields';
import { RISKS } from './risk-fields';
import type { PlanBoardSetup, SwimlaneBy } from './board-model';
import {
  NO_LANE,
  cardLanes,
  fieldLane,
  labelsIn,
  laneCalcOf,
  laneFieldOf,
  laneValue,
  personLanes,
  stampLane,
  type LaneCalc,
  type LaneField,
  type LaneHead,
} from './board-lane-fields';

// A status as people read it (docs/specs/026-plan/plan-board.md "All Cards"): the name a column gives it,
// else the status itself without a new board's suffix, words capitalised.
// A card's status as the project has it (docs/specs/026-plan/plan-board.md "A state no board names"): one no
// board in the project names any more (its board or column gone) reads as no status, so the card shows and
// groups as No status; the card keeps it, so undoing the board's deletion puts the card straight back. Given no
// names (a caller that has none), every status stands.
export function namedStatus(item: Item, names?: ReadonlyMap<string, string>): string | undefined {
  const s = itemStatus(item);
  return s && (!names || names.has(s)) ? s : undefined;
}

export function statusLabel(status: string, names?: ReadonlyMap<string, string>): string {
  const named = names?.get(status);
  if (named) return named;
  // An unnamed status reads as its id in Title Case ("in-review~ab12" is "In Review").
  const words = statusTitleCase(status.split('~')[0]!.replace(/[-_]+/g, ' '));
  return words || status;
}

function laneOf(
  by: SwimlaneBy,
  item: Item,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
  field?: LaneField,
  calc?: LaneCalc,
): LaneHead {
  switch (by) {
    case 'field':
      if (!field) return { key: NO_LANE, label: '', field: null, value: null };
      // A Created or Edited field's row is its stamp's; a Person or Card field's rows are lanesOf's, one per value.
      return field.readOnly && !field.calculated
        ? stampLane(field, item)
        : fieldLane(field, laneValue(field, item, calc));
    case 'status': {
      const s = namedStatus(item, statusNames);
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
  }
}

// The rows an item sits in: one, or one per value of a Person or Card field (each of its values' when the field holds
// several, item-types.md "Holds Several").
function lanesOf(
  by: SwimlaneBy,
  item: Item,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
  field?: LaneField,
  calc?: LaneCalc,
  everyValue = false,
): LaneHead[] {
  if (everyValue && by === 'field' && field && (field.kind === 'labels' || field.multi)) {
    const raw = field.multi ? item.fields[field.id] : labelsIn(field.id, item);
    const values = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string' && x !== '')
      : [];
    return values.length ? values.map((v) => fieldLane(field, v)) : [fieldLane(field, undefined)];
  }
  if (by === 'field' && !field?.readOnly && field?.kind === 'person')
    return personLanes(field, item);
  if (by === 'field' && !field?.readOnly && field?.kind === 'card')
    return cardLanes(field, item, items, types);
  return [laneOf(by, item, types, statusNames, field, calc)];
}

function laneSort(
  by: SwimlaneBy,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
  field?: LaneField,
): (a: LaneHead, b: LaneHead) => number {
  const order = [...(statusNames?.keys() ?? [])];
  return (a, b) => {
    if (a.key === NO_LANE) return b.key === NO_LANE ? 0 : 1;
    if (b.key === NO_LANE) return -1;
    // Card rows in the linked cards' number order, as Project rows are.
    if (by === 'field' && field?.kind === 'card')
      return (items.get(a.value as string)?.key ?? 0) - (items.get(b.value as string)?.key ?? 0);
    if (by === 'field' && field?.kind === 'person') return a.label.localeCompare(b.label);
    if (by === 'field' && field) return fieldLaneOrder(field, a.value, b.value);
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
    return a.label.localeCompare(b.label);
  };
}

const byText = (a: unknown, b: unknown) =>
  String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });

// Choice: option order, then others A to Z. Risk: Critical first. Checkbox: Yes first. Number: lowest first. Date: earliest first
// (ISO strings sort as dates). Text and labels: A to Z ignoring case.
function fieldLaneOrder(field: LaneField, a: unknown, b: unknown): number {
  if (field.kind === 'checkbox') return Number(b === true) - Number(a === true);
  if (field.kind === 'number' || field.kind === 'percent') return Number(a) - Number(b);
  if (field.kind === 'date') return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  if (field.kind === 'risk')
    return RISKS.indexOf(a as (typeof RISKS)[number]) - RISKS.indexOf(b as (typeof RISKS)[number]);
  if (field.kind === 'choice') {
    const opts = field.options ?? [];
    const ia = opts.indexOf(String(a));
    const ib = opts.indexOf(String(b));
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  }
  return byText(a, b);
}

// Items grouped into swimlanes (docs/specs/026-plan/plan-board.md "Swimlanes"), shared by a board and the Gantt
// chart (plan-views.md "Swimlanes"): the lanes the items fall in, named and ordered as a board orders them, and each
// item's lane keys (one, or one per value of a field that holds several). A field lane resolves against the project's
// types; a field no type offers any more is no lanes.
interface LaneGroups {
  by: SwimlaneBy;
  field: LaneField | undefined;
  lanes: LaneHead[];
  lanesOfItem: Map<string, readonly string[]>;
}

// Whether an item sits in a lane.
export const inLane = (
  groups: Pick<LaneGroups, 'lanesOfItem'>,
  itemId: string,
  laneKey: string,
): boolean => groups.lanesOfItem.get(itemId)?.includes(laneKey) ?? false;

export function laneGroups(
  swimlaneBy: SwimlaneBy,
  swimlaneField: string | undefined,
  list: readonly Item[],
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
  // The boards' done rule, for a Rollup's Count Done (0 without it).
  isDone?: IsDoneStatus,
  // A Labels or Multiple Choice card sits in a row per value, not its first (a filter's reading, never a board's).
  everyValue = false,
): LaneGroups {
  const field = swimlaneBy === 'field' ? laneFieldOf(swimlaneField, types, everyValue) : undefined;
  const by: SwimlaneBy = swimlaneBy === 'field' && !field ? 'none' : swimlaneBy;
  const laneMap = new Map<string, LaneHead>();
  const lanesOfItem = new Map<string, readonly string[]>();
  const calc = field?.calculated ? laneCalcOf(items, types, isDone) : undefined;
  for (const it of list) {
    const heads = lanesOf(by, it, items, types, statusNames, field, calc, everyValue);
    for (const lane of heads) if (!laneMap.has(lane.key)) laneMap.set(lane.key, lane);
    lanesOfItem.set(
      it.id,
      heads.map((l) => l.key),
    );
  }
  const lanes = [...laneMap.values()].sort(laneSort(by, items, types, statusNames, field));
  return { by, field, lanes, lanesOfItem };
}

// A board's lanes: the items' own, then the empty lanes a card can be dropped into.
export function boardLanes(
  setup: PlanBoardSetup,
  scoped: readonly Item[],
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames: ReadonlyMap<string, string> | undefined,
  isDone: IsDoneStatus,
): LaneGroups {
  const groups = laneGroups(
    setup.swimlaneBy,
    setup.swimlaneField,
    scoped,
    items,
    types,
    statusNames,
    isDone,
  );
  const { by, field, lanesOfItem } = groups;
  const laneMap = new Map<string, LaneHead>(groups.lanes.map((l) => [l.key, l]));
  // A board with swimlanes always offers the empty group as a drop target (a checkbox has none).
  if (
    by !== 'none' &&
    by !== 'type' &&
    by !== 'status' &&
    field?.kind !== 'checkbox' &&
    !field?.readOnly &&
    !laneMap.has(NO_LANE)
  ) {
    laneMap.set(NO_LANE, lanesOf(by, { fields: {} } as Item, items, types, statusNames, field)[0]!);
  }
  // Every option of a Choice, every level of a Risk, and both Yes and No, are rows to drop into, cards or not.
  if (
    field?.kind === 'choice' ||
    field?.kind === 'risk' ||
    (field?.kind === 'checkbox' && !field.readOnly)
  ) {
    const values: (string | boolean)[] =
      field.kind === 'checkbox'
        ? [true, false]
        : field.kind === 'risk'
          ? [...RISKS]
          : [...(field.options ?? [])];
    for (const v of values) {
      const lane = fieldLane(field, v);
      if (!laneMap.has(lane.key)) laneMap.set(lane.key, lane);
    }
  }
  // Status rows include every status the tab's boards name, so a card can be dropped into an empty one.
  if (by === 'status') {
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
    laneMap.set(NO_LANE, lanesOf(by, { fields: {} } as Item, items, types, statusNames, field)[0]!);
  const lanes = [...laneMap.values()].sort(laneSort(by, items, types, statusNames, field));
  return { by, field, lanes, lanesOfItem };
}

// `cards` narrowed to those matching every filter, as they are (an Archive board's archived cards too). A parent or a
// linked card is looked up in `all`. One lane grouping per filter, over the cards still in play.
export function cardsMatchingFilters(
  cards: readonly Item[],
  filters: readonly CardSearchFilter[],
  all: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): Item[] {
  let out = [...cards];
  for (const f of filters) {
    if (out.length === 0) break;
    const groups = laneGroups(f.by, f.field, out, all, types, statusNames, undefined, true);
    // A filter on a field that is gone matches no card, its empty value too (board-widgets.md "Saved filters"): grouping
    // falls back to no rows, whose one key is the empty value's.
    if (f.by === 'field' && groups.by !== 'field') return [];
    // A card holding several values matches a filter on any of them (item-types.md "Holds Several").
    out = out.filter((c) => inLane(groups, c.id, f.key));
  }
  return out;
}
