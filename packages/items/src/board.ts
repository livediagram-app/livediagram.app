// The Plan board set-up and its projection (docs/specs/026-plan/plan-board.md).
// The board stores only its set-up; what it shows is computed here from the
// item store, so every board (and the api's tab scoping) reads items the same way.

import { itemColourOf } from './item-colour';
import { ITEM_TYPE_PATTERN } from './limits';
import { readBoardWidgets, type BoardWidgetKind } from './board-widgets';
import { statusTitleCase } from './status-title-case';
import type { Item, ItemPerson } from './item';
import { LANE_FIELD_BUILT_INS, itemAssignee, itemLabels, itemStatus, itemTitle } from './item';
import type { ItemMove } from './item';
import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';
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
import { HEX_COLOUR, isObj } from './validate';

export interface PlanColumn {
  id: string;
  status: string;
  name: string;
  wipLimit?: number;
  color?: string;
  // How many slots wide it is (docs/specs/026-plan/plan-board.md "The board set-up"); absent is 1.
  width?: ColumnWidth;
}

export const COLUMN_WIDTHS = [1, 2, 3] as const;
export type ColumnWidth = (typeof COLUMN_WIDTHS)[number];

// 'field' groups by `swimlaneField`, any field the document's types offer (docs/specs/026-plan/plan-board.md
// "Swimlanes by a field").
export const SWIMLANE_BY = [
  'none',
  'assignee',
  'type',
  'priority',
  'parent',
  'status',
  'field',
] as const;
export type SwimlaneBy = (typeof SWIMLANE_BY)[number];

export const CARD_FIELDS = [
  'key',
  'type',
  'assignee',
  'priority',
  'labels',
  'estimate',
  // When the work begins (docs/specs/026-plan/items.md "Fields").
  'start',
  'due',
  'votes',
  'checklist',
  // How many comments an open thread holds (docs/specs/026-plan/items.md "Comments").
  'comments',
  // A Detailed card's extras: two lines of its description, and the project it sits under.
  'description',
  'parent',
] as const;
// A card field: a built-in one, or a card type's custom field by its id (`f-…`), placed by the type's Display
// (docs/specs/026-plan/item-types.md "Card display").
export type CustomCardField = `f-${string}`;
export type CardField = (typeof CARD_FIELDS)[number] | CustomCardField;
export function isCustomCardField(field: string): field is CustomCardField {
  return CUSTOM_FIELD_ID_PATTERN.test(field);
}

// How much of each card a board draws (docs/specs/026-plan/plan-board.md "The board set-up"): the title
// only, one line, or every field it shows. Absent is Detailed.
export const CARD_SIZES = ['minimal', 'compact', 'detailed'] as const;
export type CardSize = (typeof CARD_SIZES)[number];

// The fields each card size can draw (docs/specs/026-plan/plan-board.md "The board set-up"): a field the
// board shows outside its size's set is kept but not drawn, and its tile in the Cards menu says so.
export const CARD_SIZE_FIELDS: Readonly<Record<CardSize, readonly CardField[]>> = {
  // Minimal's one line can carry these beside the title (a type's Display picks them; none by default).
  minimal: ['key', 'priority', 'due', 'assignee'],
  compact: ['key', 'type', 'assignee', 'priority', 'start', 'due', 'votes', 'comments'],
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
  // The field a 'field' board lanes by: a built-in of LANE_FIELD_BUILT_INS or a custom field id.
  swimlaneField?: string;
  cardFields: CardField[];
  cardSize?: CardSize;
  // An Archive board (docs/specs/026-plan/items.md "Archive"): it shows only archived items.
  archive?: boolean;
  // An All Cards board (docs/specs/026-plan/plan-board.md "All Cards"): every card, whatever its status.
  allCards?: boolean;
  // The card types it shows and takes (docs/specs/026-plan/plan-board.md "Card types a board shows"): Add Card
  // and the palette add only these, and cards of other types are hidden on it (never moved). Absent is every type.
  addTypes?: string[];
  // The header's widgets in order (docs/specs/026-plan/board-widgets.md); absent is the default set.
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
  // From the board's widgets (docs/specs/026-plan/board-widgets.md): only items assigned to this person
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

// An archived item (docs/specs/026-plan/items.md "Archive"): off every board but an Archive board.
export function isArchived(item: Item): boolean {
  return item.fields['archived'] === true;
}

// A flagged item (docs/specs/026-plan/items.md "Flags"): marked for attention wherever it shows.
export function isFlagged(item: Item): boolean {
  return item.fields['flagged'] === true;
}

// The Trash (docs/specs/026-plan/items.md "Trash"): a status no board shows. A trashed item keeps the status
// it had under `trashedFrom`, so it can be restored to it.
export const TRASH_STATUS = 'trash';
export const TRASHED_FROM_FIELD = 'trashedFrom';

export function isTrashed(item: Item): boolean {
  return itemStatus(item) === TRASH_STATUS;
}

export interface LaneHead {
  key: string;
  label: string;
  // What a drop into this lane sets (null clears the field). 'field': `fieldId`, a field lane's field.
  field: 'assignee' | 'type' | 'priority' | 'parent' | 'status' | 'field' | null;
  value: Item['fields'][string] | null;
  person?: ItemPerson;
  // A Project lane's own colour (docs/specs/026-plan/items.md "Colour"), a dot before its name.
  colour?: string;
  fieldId?: string;
  fieldKind?: LaneFieldKind;
}

// How a field lane groups (docs/specs/026-plan/plan-board.md "Swimlanes by a field").
export type LaneFieldKind = 'choice' | 'checkbox' | 'number' | 'date' | 'text' | 'labels' | 'card';
export interface LaneField {
  id: string;
  label: string;
  kind: LaneFieldKind;
  options?: readonly string[];
  // A Card field's target type: a row per linked card (docs/specs/026-plan/item-types.md "Card fields").
  linkType?: string;
}

const BUILT_IN_LANE_FIELDS: readonly LaneField[] = [
  { id: 'labels', label: 'Labels', kind: 'labels' },
  { id: 'estimate', label: 'Estimate', kind: 'number' },
  { id: 'start', label: 'Start Date', kind: 'date' },
  { id: 'due', label: 'Due Date', kind: 'date' },
];
const GROUPING_KINDS = new Set<string>(['choice', 'checkbox', 'number', 'date', 'text', 'card']);

// The fields a board can lane by, of the types it shows: the built-ins those types offer, then every grouping
// custom field in catalogue order, each once (named as the first type that offers it names it).
export function laneFieldsOf(types: readonly ItemTypeDef[]): LaneField[] {
  // A built-in lane field only when one of the types offers it (docs/specs/026-plan/plan-board.md "Swimlanes by a
  // field"): a board or chart lanes by what its own cards can hold.
  return everyLaneField(types).filter(
    (f) => !BUILT_IN_LANE_FIELDS.includes(f) || types.some((t) => t.fields.includes(f.id)),
  );
}

// Every field a board could lane by, offered or not: what a board already laned by a field looks it up in.
function everyLaneField(types: readonly ItemTypeDef[]): LaneField[] {
  const out: LaneField[] = [...BUILT_IN_LANE_FIELDS];
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (!GROUPING_KINDS.has(c.kind) || !t.fields.includes(c.id)) continue;
      if (out.some((f) => f.id === c.id)) continue;
      out.push({
        id: c.id,
        label: c.label,
        kind: c.kind as LaneFieldKind,
        ...(c.options ? { options: c.options } : {}),
        ...(c.linkType ? { linkType: c.linkType } : {}),
      });
    }
  return out;
}

export function laneFieldOf(
  id: string | undefined,
  types: readonly ItemTypeDef[],
): LaneField | undefined {
  return id ? everyLaneField(types).find((f) => f.id === id) : undefined;
}

// An item's value for a field lane, or undefined for the No row (a checkbox is never undefined).
function laneValue(
  field: LaneField,
  item: Pick<Item, 'fields'>,
): string | number | boolean | undefined {
  if (field.kind === 'labels') return itemLabels(item)[0];
  const v = item.fields[field.id];
  if (field.kind === 'checkbox') return v === true;
  if (field.kind === 'number') return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const s = field.kind === 'text' ? v.trim() : v;
  return s ? s : undefined;
}

function fieldLane(field: LaneField, value: string | number | boolean | undefined): LaneHead {
  const base = { field: 'field' as const, fieldId: field.id, fieldKind: field.kind };
  if (value === undefined)
    return { key: NO_LANE, label: `No ${field.label}`, value: null, ...base };
  const label = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return { key: `f:${JSON.stringify(value)}`, label, value, ...base };
}

// What a drop into a lane sets on an item (docs/specs/026-plan/plan-board.md "Moving cards"): the lane's
// field, a type, or nothing for a status row (the move carries the status). A Labels row puts its label
// first, keeping the card's others; a Checkbox No row and any No row clear the field.
export function laneDropPatch(
  lane: LaneHead | undefined,
  item?: Pick<Item, 'fields'>,
): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  if (!lane || !lane.field || lane.field === 'status') return {};
  if (lane.field === 'type') return typeof lane.value === 'string' ? { type: lane.value } : {};
  if (lane.field === 'field') {
    const id = lane.fieldId;
    if (!id) return {};
    if (lane.value === null || lane.value === false) return { clear: [id] };
    if (lane.fieldKind === 'labels' && typeof lane.value === 'string') {
      const rest = item ? itemLabels(item).filter((l) => l !== lane.value) : [];
      return { set: { [id]: [lane.value, ...rest] } };
    }
    return { set: { [id]: lane.value } };
  }
  return lane.value === null ? { clear: [lane.field] } : { set: { [lane.field]: lane.value } };
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
  // Whether the board draws rows: false with no swimlanes, or a field lane whose field is gone.
  swimlanes: boolean;
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

// How wide a board has to be for its columns to sit side by side without scrolling (docs/specs/026-plan/
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

// Whether a board shows (and takes) cards of a type (docs/specs/026-plan/plan-board.md "Card types a board
// shows"): every type when it names none. Given the catalogue, it follows boardAddTypes: a board whose every
// named type has since been deleted shows and takes every type again.
export function boardShowsType(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  type: string,
  types?: readonly { id: string }[],
): boolean {
  if (!setup.addTypes) return true;
  return types ? boardTakesType(setup, types, type) : setup.addTypes.includes(type);
}

// The types a board shows and takes, in the catalogue's order: its own, or every one. Never empty while
// the catalogue is not: a board whose every named type has since been deleted takes every type again
// (docs/specs/026-plan/plan-board.md "Card types a board shows").
export function boardAddTypes<T extends { id: string }>(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly T[],
): T[] {
  if (!setup.addTypes) return [...types];
  const own = types.filter((t) => setup.addTypes!.includes(t.id));
  return own.length ? own : [...types];
}

// Whether a board shows and takes cards of `typeId` (palette drops, moves), by the same rule as boardAddTypes.
export function boardTakesType(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly { id: string }[],
  typeId: string,
): boolean {
  return boardAddTypes(setup, types).some((t) => t.id === typeId);
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

// A status as people read it (docs/specs/026-plan/plan-board.md "All Cards"): the name a column gives it,
// else the status itself without a new board's suffix, words capitalised.
// A card's status as the document has it (docs/specs/026-plan/plan-board.md "A state no board names"): one no
// board in the document names any more (its board or column gone) reads as no status, so the card shows and
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
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
  field?: LaneField,
): LaneHead {
  switch (by) {
    case 'field': {
      if (!field) return { key: NO_LANE, label: '', field: null, value: null };
      const lane = fieldLane(field, laneValue(field, item));
      // A Card field's row is named by the linked card (docs/specs/026-plan/item-types.md "Card fields").
      if (field.kind === 'card' && typeof lane.value === 'string') {
        const linked = items.get(lane.value);
        return { ...lane, label: linked ? itemTitle(linked) : 'Missing card' };
      }
      return lane;
    }
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
    case 'parent': {
      const id = item.fields['parent'];
      const parent = typeof id === 'string' ? items.get(id) : undefined;
      return parent
        ? {
            key: `e:${parent.id}`,
            label: itemTitle(parent),
            field: 'parent',
            value: parent.id,
            ...(itemColourOf(parent) ? { colour: itemColourOf(parent)! } : {}),
          }
        : { key: NO_LANE, label: 'No parent', field: 'parent', value: null };
    }
  }
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
    if (by === 'parent') {
      return (items.get(a.value as string)?.key ?? 0) - (items.get(b.value as string)?.key ?? 0);
    }
    return a.label.localeCompare(b.label);
  };
}

const byText = (a: unknown, b: unknown) =>
  String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });

// Choice: option order, then others A to Z. Checkbox: Yes first. Number: lowest first. Date: earliest first
// (ISO strings sort as dates). Text and labels: A to Z ignoring case.
function fieldLaneOrder(field: LaneField, a: unknown, b: unknown): number {
  if (field.kind === 'checkbox') return Number(b === true) - Number(a === true);
  if (field.kind === 'number') return Number(a) - Number(b);
  if (field.kind === 'date') return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
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
// item's lane key. A field lane resolves against the document's types; a field no type offers any more is no lanes.
export interface LaneGroups {
  by: SwimlaneBy;
  field: LaneField | undefined;
  lanes: LaneHead[];
  laneOfItem: Map<string, string>;
}

export function laneGroups(
  swimlaneBy: SwimlaneBy,
  swimlaneField: string | undefined,
  list: readonly Item[],
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): LaneGroups {
  const field = swimlaneBy === 'field' ? laneFieldOf(swimlaneField, types) : undefined;
  const by: SwimlaneBy = swimlaneBy === 'field' && !field ? 'none' : swimlaneBy;
  const laneMap = new Map<string, LaneHead>();
  const laneOfItem = new Map<string, string>();
  for (const it of list) {
    const lane = laneOf(by, it, items, types, statusNames, field);
    if (!laneMap.has(lane.key)) laneMap.set(lane.key, lane);
    laneOfItem.set(it.id, lane.key);
  }
  const lanes = [...laneMap.values()].sort(laneSort(by, items, types, statusNames, field));
  return { by, field, lanes, laneOfItem };
}

// A board's lanes: the items' own, then the empty lanes a card can be dropped into.
function boardLanes(
  setup: PlanBoardSetup,
  scoped: readonly Item[],
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): LaneGroups {
  const groups = laneGroups(
    setup.swimlaneBy,
    setup.swimlaneField,
    scoped,
    items,
    types,
    statusNames,
  );
  const { by, field, laneOfItem } = groups;
  const laneMap = new Map<string, LaneHead>(groups.lanes.map((l) => [l.key, l]));
  // A board with swimlanes always offers the empty group as a drop target (a checkbox has none).
  if (
    by !== 'none' &&
    by !== 'type' &&
    by !== 'status' &&
    field?.kind !== 'checkbox' &&
    !laneMap.has(NO_LANE)
  ) {
    laneMap.set(NO_LANE, laneOf(by, { fields: {} } as Item, items, types, statusNames, field));
  }
  // Every option of a Choice, and both Yes and No, are rows to drop into, cards or not.
  if (field?.kind === 'choice' || field?.kind === 'checkbox') {
    const values: (string | boolean)[] =
      field.kind === 'checkbox' ? [true, false] : [...(field.options ?? [])];
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
    laneMap.set(NO_LANE, laneOf(by, { fields: {} } as Item, items, types, statusNames, field));
  const lanes = [...laneMap.values()].sort(laneSort(by, items, types, statusNames, field));
  return { by, field, lanes, laneOfItem };
}

export function projectBoard(
  setup: PlanBoardSetup,
  items: ReadonlyMap<string, Item>,
  quick?: QuickFilter,
  // The document's type catalogue (docs/specs/026-plan/item-types.md): the order and names of type rows.
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
  // An All Cards board (docs/specs/026-plan/plan-board.md "All Cards") shows every card that is not
  // archived, whatever its status, in its one column.
  const allBoard = setup.allCards === true && !archiveBoard;
  // A board that names its card types shows only those (every type again once none of them is left in the
  // catalogue); the rest stay where they are, unseen here. Resolved once, not per card.
  const shownTypes = setup.addTypes ? new Set(boardAddTypes(setup, types).map((t) => t.id)) : null;
  for (const it of items.values()) {
    if (isTrashed(it)) continue;
    if (isArchived(it) !== archiveBoard) continue;
    if (shownTypes && !shownTypes.has(it.type)) continue;
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

  const { by, lanes, laneOfItem } = boardLanes(setup, scoped, items, types, statusNames);

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
  return { columns, lanes, swimlanes: by !== 'none', unplaced, doneCount, total: scoped.length };
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
    if (typeof color === 'string' && HEX_COLOUR.test(color)) col.color = color;
    const width = (c as { width?: unknown }).width;
    if (width === 2 || width === 3) col.width = width;
    columns.push(col);
  }
  // No columns is a board waiting for its first (docs/specs/026-plan/plan-board.md "The board set-up").
  // Every board shows every card (docs/specs/026-plan/plan-board.md): a `scope` an older board stored is
  // read past.
  const votingIn = isObj(input['voting']) ? input['voting'] : {};
  const budget = votingIn['budget'];
  let swimlaneBy = (SWIMLANE_BY as readonly unknown[]).includes(input['swimlaneBy'])
    ? (input['swimlaneBy'] as SwimlaneBy)
    : 'none';
  // A field lane keeps its field id while it is one a lane could name; the field itself may come and go.
  const laneField = input['swimlaneField'];
  const swimlaneField =
    swimlaneBy === 'field' &&
    typeof laneField === 'string' &&
    ((LANE_FIELD_BUILT_INS as readonly string[]).includes(laneField) ||
      CUSTOM_FIELD_ID_PATTERN.test(laneField))
      ? laneField
      : undefined;
  if (swimlaneBy === 'field' && !swimlaneField) swimlaneBy = 'none';
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
    ...(swimlaneField ? { swimlaneField } : {}),
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
  'comments',
];

export function columnForStatus(
  setup: PlanBoardSetup,
  status: string | undefined,
): PlanColumn | undefined {
  return setup.columns.find((c) => c.status === status);
}

// The built-in swimlane groupings a set of card types (a board's, or a chart's) can use: None and Status always,
// Type when there is more than one, and Assignee, Priority and Parent when one of the types offers that field
// (docs/specs/026-plan/plan-board.md "Swimlanes").
export function swimlaneGroupingsFor(types: readonly ItemTypeDef[]): SwimlaneBy[] {
  const offers = (f: string) => types.some((t) => t.fields.includes(f));
  return SWIMLANE_BY.filter((s) => {
    if (s === 'field') return false;
    if (s === 'none' || s === 'status') return true;
    if (s === 'type') return types.length > 1;
    return offers(s);
  });
}
