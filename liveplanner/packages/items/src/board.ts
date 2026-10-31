// The Plan board set-up and its projection (docs/specs/026-plan/plan-board.md).
// The board stores only its set-up; what it shows is computed here from the
// item store, so every board (and the api's tab scoping) reads items the same way.

import { itemColourOf } from './item-colour';
import { ITEM_TYPE_PATTERN } from './limits';
import { readBoardWidgets, type BoardWidgetKind } from './board-widgets';
import { statusTitleCase } from './status-title-case';
import type { Item, ItemFieldValue, ItemPerson } from './item';
import {
  cardKey,
  fieldCardIds,
  fieldPeople,
  holdsSeveral,
  personKey,
  swappedValues,
} from './several-values';
import {
  ARCHIVED_FIELD,
  LANE_FIELD_BUILT_INS,
  itemAssignee,
  itemLabels,
  itemStatus,
  itemTitle,
} from './item';
import type { ItemMove } from './item';
import { CUSTOM_FIELD_ID_PATTERN, typeIn } from './type-catalogue';
import { isNotified } from './notify-fields';
import { percentText, percentValue } from './percent-fields';
import { boardSortComparator, normaliseBoardSort, type BoardSortLevel } from './board-sort';
import {
  ITEM_TYPES,
  LEGACY_PARENT_GROUPING,
  PARENT_FIELD_ID,
  linkTypesOf,
  type ItemTypeDef,
} from './item-types';
import { PRIORITIES, PRIORITY_LABELS, isPriority, type Priority } from './fields';
import { byRank } from './apply';
import {
  ITEM_STATUS_MAX,
  PLAN_COLUMNS_MAX,
  PLAN_COLUMN_NAME_MAX,
  PLAN_TITLE_MAX,
  PLAN_WIP_MAX,
} from './limits';
import { HEX_COLOUR, isObj } from './validate';
import { isDoneColumn } from './done-columns';
import {
  STAMP_FIELDS,
  STAMP_FIELD_LABELS,
  isStampField,
  itemStampPerson,
  itemStampTime,
  stampDay,
  type StampTimeField,
} from './card-stamps';

export interface PlanColumn {
  id: string;
  status: string;
  name: string;
  wipLimit?: number;
  color?: string;
  // How many slots wide it is (docs/specs/026-plan/plan-board.md "The board set-up"); absent is 1.
  width?: ColumnWidth;
  // Whether its cards count as done (docs/specs/026-plan/plan-board.md "Done columns"). Absent: by its name, or on
  // an older board by its `doneColumnId` (isDoneColumn).
  done?: boolean;
}

export const COLUMN_WIDTHS = [1, 2, 3] as const;
export type ColumnWidth = (typeof COLUMN_WIDTHS)[number];

// 'field' groups by `swimlaneField`, any field the project's types offer (docs/specs/026-plan/plan-board.md
// "Swimlanes by a field").
export const SWIMLANE_BY = ['none', 'assignee', 'type', 'priority', 'status', 'field'] as const;
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
  // A Detailed card's extra: two lines of its description.
  'description',
  // A card's Attachments (docs/specs/026-plan/items.md "Attachments"): a picture glyph and how many it holds.
  'attachments',
  // Its cover picture across the top of a Detailed card, placed only in the Header (docs/specs/026-plan/item-types.md
  // "Card display").
  'cover',
  // How long the card has sat in its status (docs/specs/026-plan/item-types.md "Card display"): in no default.
  'age',
  // Its stamps (docs/specs/026-plan/items.md "Created and Last Edited"; card-stamps.ts): Age's family, in no default.
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
] as const;
// A card field: a built-in one, or a card type's custom field by its id (`f-…`, or the reserved `parent`), placed
// by the type's Display (docs/specs/026-plan/item-types.md "Card display").
export type CustomCardField = `f-${string}` | typeof PARENT_FIELD_ID;
export type CardField = (typeof CARD_FIELDS)[number] | CustomCardField;
export function isCustomCardField(field: string): field is CustomCardField {
  return CUSTOM_FIELD_ID_PATTERN.test(field);
}

// How much of each card a board draws (docs/specs/026-plan/plan-board.md "The board set-up"): one line, or
// every field it shows. Absent is Detailed.
export const CARD_SIZES = ['minimal', 'detailed'] as const;
export type CardSize = (typeof CARD_SIZES)[number];

// A stored or sent card size as it reads now: Minimal, else Detailed. The retired Compact size (`'compact'`, still
// in older boards, Plan card elements and agent prompts) reads as Detailed, as does anything unknown.
export function readCardSize(input: unknown): CardSize {
  return input === 'minimal' ? 'minimal' : 'detailed';
}

// The fields each card size can draw (docs/specs/026-plan/plan-board.md "The board set-up"): a field the
// board shows outside its size's set is kept but not drawn, and its tile in the Cards menu says so.
export const CARD_SIZE_FIELDS: Readonly<Record<CardSize, readonly CardField[]>> = {
  // Minimal's one line can carry these beside the title (a type's Display picks them; none by default).
  minimal: ['key', 'priority', 'due', 'age', 'assignee'],
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
  // An older board's one done column, every column after it done too; now written for older editors only, as the
  // first done column (docs/specs/026-plan/plan-board.md "Done columns").
  doneColumnId?: string;
  swimlaneBy: SwimlaneBy;
  // The field a 'field' board lanes by: a built-in of LANE_FIELD_BUILT_INS or a custom field id.
  swimlaneField?: string;
  // Sort Cards (docs/specs/026-plan/plan-board.md "The board set-up"): up to two levels, rank breaking ties. Absent is
  // rank order.
  sortBy?: BoardSortLevel[];
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
  hideWriting: boolean;
  // Fill Tab (docs/specs/026-plan/plan-board.md "Fill Tab"): the board fills its tab for everyone, every time the tab
  // is shown, and the rest of the canvas cannot be used. Absent is off.
  fillTab?: boolean;
  // A linked board (docs/specs/026-plan/linked-boards.md): the kind of canvas record it collects. Absent is none.
  collects?: LinkedRecordKind;
}

// The kinds of canvas record a linked board collects (docs/specs/026-plan/linked-boards.md).
export const LINKED_RECORD_KINDS = ['actions'] as const;
export type LinkedRecordKind = (typeof LINKED_RECORD_KINDS)[number];

// The Due Soon widget's narrowing: due from `from` (absent: any earlier day) to `to`, not done (`finished`, the
// board's finishedStatuses, left out).
export interface QuickDueWindow {
  from?: string;
  to: string;
  finished?: string[];
}

export interface QuickFilter {
  text?: string;
  // Only Mine: only items a notifying Person field gives this person id (notify-fields.ts).
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
  return item.fields[ARCHIVED_FIELD] === true;
}

// A flagged item (docs/specs/026-plan/items.md "Flags"): marked for attention wherever it shows.
export function isFlagged(item: Item): boolean {
  return item.fields['flagged'] === true;
}

// An example card (docs/specs/026-plan/items.md "Example cards"): one a Plan template made to show how its boards run,
// until Clear Example Cards trashes it or Keep Them takes the flag off.
export const EXAMPLE_FIELD = 'example';
export function isExampleItem(item: Item): boolean {
  return item.fields[EXAMPLE_FIELD] === true;
}

// The Trash (docs/specs/026-plan/items.md "Trash"): a status no board shows. A trashed item keeps the status
// it had under `trashedFrom`, so it can be restored to it.
export const TRASH_STATUS = 'trash';
export const TRASHED_FROM_FIELD = 'trashedFrom';

export function isTrashed(item: Item): boolean {
  return itemStatus(item) === TRASH_STATUS;
}

// The card a link (a Parent, a Card field) points at; undefined while it is gone, trashed or archived, when the
// link reads "Missing card" (docs/specs/026-plan/item-types.md "Card fields").
export function linkedCard(items: ReadonlyMap<string, Item>, id: unknown): Item | undefined {
  const card = typeof id === 'string' && id ? items.get(id) : undefined;
  return card && !isTrashed(card) && !isArchived(card) ? card : undefined;
}

export interface LaneHead {
  key: string;
  label: string;
  // What a drop into this lane sets (null clears the field). 'field': `fieldId`, a field lane's field.
  field: 'assignee' | 'type' | 'priority' | 'status' | 'field' | null;
  value: Item['fields'][string] | null;
  person?: ItemPerson;
  // A Project lane's own colour (docs/specs/026-plan/items.md "Colour"), a dot before its name.
  colour?: string;
  fieldId?: string;
  fieldKind?: LaneFieldKind;
  // A row of a field that holds several (item-types.md "Holds Several"): a drop swaps values rather than setting one.
  several?: boolean;
}

// How a field lane groups (docs/specs/026-plan/plan-board.md "Swimlanes by a field").
export type LaneFieldKind =
  'choice' | 'checkbox' | 'number' | 'percent' | 'date' | 'text' | 'labels' | 'card' | 'person';
export interface LaneField {
  id: string;
  label: string;
  kind: LaneFieldKind;
  // One of the item's stamps (card-stamps.ts): read from the item itself, and a drop into its row sets nothing.
  readOnly?: true;
  options?: readonly string[];
  // A Card field's target types: a row per linked card, of any of them (docs/specs/026-plan/item-types.md "Card
  // fields").
  linkTypes?: readonly string[];
  // A Person or Card field that holds several: a card sits in each of its values' rows (item-types.md "Holds
  // Several").
  several?: boolean;
}

const BUILT_IN_LANE_FIELDS: readonly LaneField[] = [
  { id: 'labels', label: 'Labels', kind: 'labels' },
  { id: 'estimate', label: 'Estimate', kind: 'number' },
  { id: 'start', label: 'Start Date', kind: 'date' },
  { id: 'due', label: 'Due Date', kind: 'date' },
];
// The four stamps every type offers (docs/specs/026-plan/items.md "Created and Last Edited").
const STAMP_LANE_FIELDS: readonly LaneField[] = STAMP_FIELDS.map((id) => ({
  id,
  label: STAMP_FIELD_LABELS[id],
  kind: id === 'createdBy' || id === 'updatedBy' ? 'person' : 'date',
  readOnly: true,
}));
const GROUPING_KINDS = new Set<string>([
  'choice',
  'checkbox',
  'number',
  // A share groups as a Number, a row per share (docs/specs/026-plan/item-types.md "Percent").
  'percent',
  'date',
  'text',
  'card',
  'person',
  'labels',
]);

// The fields a board can lane by, of the types it shows: the built-ins those types offer, then every grouping
// custom field in catalogue order, each once (named as the first type that offers it names it).
export function laneFieldsOf(types: readonly ItemTypeDef[]): LaneField[] {
  // A built-in lane field only when one of the types offers it (docs/specs/026-plan/plan-board.md "Swimlanes by a
  // field"): a board or chart lanes by what its own cards can hold.
  // The stamps with any type at all: every type offers them.
  return everyLaneField(types).filter((f) =>
    f.readOnly
      ? types.length > 0
      : !BUILT_IN_LANE_FIELDS.includes(f) || types.some((t) => t.fields.includes(f.id)),
  );
}

// Every field a board could lane by, offered or not: what a board already laned by a field looks it up in. The
// stamps come after the built-ins, before the custom fields.
function everyLaneField(types: readonly ItemTypeDef[]): LaneField[] {
  const out: LaneField[] = [...BUILT_IN_LANE_FIELDS, ...STAMP_LANE_FIELDS];
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (!GROUPING_KINDS.has(c.kind) || !t.fields.includes(c.id)) continue;
      if (out.some((f) => f.id === c.id)) continue;
      out.push({
        id: c.id,
        label: c.label,
        kind: c.kind as LaneFieldKind,
        ...(c.options ? { options: c.options } : {}),
        ...(c.kind === 'card' ? { linkTypes: linkTypesOf(c) } : {}),
        ...(holdsSeveral(c) ? { several: true } : {}),
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
  if (field.kind === 'labels') return labelsIn(field.id, item)[0];
  const v = item.fields[field.id];
  if (field.kind === 'checkbox') return v === true;
  if (field.kind === 'number') return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  if (field.kind === 'percent') return typeof v === 'number' ? percentValue(v) : undefined;
  if (typeof v !== 'string') return undefined;
  const s = field.kind === 'text' ? v.trim() : v;
  return s ? s : undefined;
}

// A Labels field's labels: the built-in's, or a custom Labels field's (docs/specs/026-plan/item-types.md "Custom field
// kinds").
function labelsIn(fieldId: string, item: Pick<Item, 'fields'>): string[] {
  if (fieldId === 'labels') return itemLabels(item);
  const v = item.fields[fieldId];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

// A field lane's field as several-values.ts reads it.
const severalOf = (field: LaneField) => ({
  kind: field.kind as 'person' | 'card',
  multiple: field.several === true,
});

// What every row of a field lane carries.
const laneBase = (field: LaneField) => ({
  field: 'field' as const,
  fieldId: field.id,
  fieldKind: field.kind,
  ...(field.several ? { several: true } : {}),
});

// A Person field's rows: its person's, or each of its people's when it holds several, named and drawn as an Assignee
// row (plan-board.md "Swimlanes by a field"); No {Field} when it holds none.
function personLanes(field: LaneField, item: Pick<Item, 'fields'>): LaneHead[] {
  const base = laneBase(field);
  const people = fieldPeople(severalOf(field), item.fields[field.id]);
  if (people.length === 0)
    return [{ key: NO_LANE, label: `No ${field.label}`, value: null, ...base }];
  return people.map((p) => ({
    key: `f:p:${p.id}`,
    label: p.name,
    value: { ...p },
    person: p,
    ...base,
  }));
}

// A Card field's rows: its linked card's, or each linked card's when it holds several, named by the linked card with
// its colour dot when it has a Colour (docs/specs/026-plan/item-types.md "Card fields"); No {Field} when it links none.
function cardLanes(
  field: LaneField,
  item: Pick<Item, 'fields'>,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LaneHead[] {
  const ids = fieldCardIds(severalOf(field), item.fields[field.id]);
  if (ids.length === 0) return [fieldLane(field, undefined)];
  return ids.map((id) => {
    const linked = linkedCard(items, id);
    const colour = linked ? itemColourOf(linked, typeIn(types, linked.type)) : undefined;
    return {
      ...fieldLane(field, id),
      label: linked ? itemTitle(linked) : 'Missing card',
      ...(colour ? { colour } : {}),
    };
  });
}

// A stamp's row: the person, or the local day of the moment (docs/specs/026-plan/items.md "Created and Last Edited").
// A card stored without one sits in the No row.
function stampLane(field: LaneField, item: Partial<Item>): LaneHead {
  if (field.id === 'createdBy' || field.id === 'updatedBy') {
    const p = itemStampPerson(item, field.id);
    return personLanes(field, { fields: p ? { [field.id]: { ...p } } : {} })[0]!;
  }
  const at = itemStampTime(item, field.id as StampTimeField);
  return fieldLane(field, at === undefined ? undefined : stampDay(at));
}

function fieldLane(field: LaneField, value: string | number | boolean | undefined): LaneHead {
  const base = laneBase(field);
  if (value === undefined)
    return { key: NO_LANE, label: `No ${field.label}`, value: null, ...base };
  const label =
    typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : field.kind === 'percent' && typeof value === 'number'
        ? percentText(value)
        : String(value);
  return { key: `f:${JSON.stringify(value)}`, label, value, ...base };
}

// What a drop into a lane sets on an item (docs/specs/026-plan/plan-board.md "Moving cards"): the lane's
// field, a type, or nothing for a status row (the move carries the status). A Labels row puts its label
// first, keeping the card's others; a Checkbox No row and any No row clear the field. A row of a field that holds
// several swaps the value of the row the card came `from` for its own, keeping the card's others (item-types.md
// "Holds Several").
export function laneDropPatch(
  lane: LaneHead | undefined,
  item?: Pick<Item, 'fields'>,
  from?: LaneHead,
): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  if (!lane || !lane.field || lane.field === 'status') return {};
  if (lane.field === 'type') return typeof lane.value === 'string' ? { type: lane.value } : {};
  if (lane.field === 'field') {
    const id = lane.fieldId;
    // Nobody changes who made a card or when: a stamp's row sets nothing.
    if (!id || isStampField(id)) return {};
    if (lane.value === null || lane.value === false) return { clear: [id] };
    if (lane.fieldKind === 'labels' && typeof lane.value === 'string') {
      const rest = item ? labelsIn(id, item).filter((l) => l !== lane.value) : [];
      return { set: { [id]: [lane.value, ...rest] } };
    }
    if (lane.several) return { set: { [id]: severalDrop(lane, item, from) } };
    return { set: { [id]: lane.value } };
  }
  return lane.value === null ? { clear: [lane.field] } : { set: { [lane.field]: lane.value } };
}

// The list a drop into a row of a field holding several leaves: the row the card came from swapped for this one.
function severalDrop(
  lane: LaneHead,
  item: Pick<Item, 'fields'> | undefined,
  from: LaneHead | undefined,
): ItemFieldValue {
  const several = { kind: lane.fieldKind as 'person' | 'card', multiple: true };
  const stored = item?.fields[lane.fieldId!];
  const left =
    from && from.fieldId === lane.fieldId && from.value !== null ? from.value : undefined;
  if (lane.fieldKind === 'person')
    return swappedValues(
      fieldPeople(several, stored),
      left as ItemPerson | undefined,
      lane.value as ItemPerson,
      personKey,
    ).map((p) => ({ ...p }));
  return swappedValues(
    fieldCardIds(several, stored),
    left as string | undefined,
    lane.value as string,
    cardKey,
  );
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
  // Sort Cards orders its cards: a card is not reordered by hand in its own cell.
  sorted?: boolean;
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

// A board's starting height (docs/specs/026-plan/blueprints/DEFAULTS.md D5): 640 px fits about seven cards a
// column. A board with no columns yet (the Blank board, waiting for Setup Board) starts at 880 px, about ten, as
// its columns are still to come and an empty frame reads better tall.
export const PLAN_BOARD_HEIGHT_PX = 640;
export const PLAN_BOARD_EMPTY_HEIGHT_PX = 880;

export function planBoardHeightFor(setup: Pick<PlanBoardSetup, 'columns'>): number {
  return setup.columns.length === 0 ? PLAN_BOARD_EMPTY_HEIGHT_PX : PLAN_BOARD_HEIGHT_PX;
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

// The types a board shows and takes, in the catalogue's order: its own, or every one. A board can take none (an
// empty list, set by turning its last type off: Add card then offers only Create Card Type); a board whose every
// named type has since been deleted takes every type again (docs/specs/026-plan/plan-board.md "Card types a board
// shows").
export function boardAddTypes<T extends { id: string }>(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly T[],
): T[] {
  if (!setup.addTypes) return [...types];
  if (setup.addTypes.length === 0) return [];
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

export function quickFilterMatches(
  quick: QuickFilter | undefined,
  item: Item,
  // The project's type catalogue: Only Mine reads each card's notifying Person fields (notify-fields.ts).
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): boolean {
  if (!quick) return true;
  if (quick.mine && !isNotified(typeIn(types, item.type), item, quick.mine)) return false;
  if (quick.person && (itemAssignee(item)?.id ?? UNASSIGNED) !== quick.person) return false;
  if (quick.priority && item.fields['priority'] !== quick.priority) return false;
  if (quick.type && item.type !== quick.type) return false;
  if (quick.due) {
    const due = item.fields['due'];
    if (typeof due !== 'string' || due > quick.due.to) return false;
    if (quick.due.from && due < quick.due.from) return false;
    if (quick.due.finished?.includes(itemStatus(item) ?? '')) return false;
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
): LaneHead {
  switch (by) {
    case 'field':
      if (!field) return { key: NO_LANE, label: '', field: null, value: null };
      // A Created or Edited field's row is its stamp's; a Person or Card field's rows are lanesOf's, one per value.
      return field.readOnly ? stampLane(field, item) : fieldLane(field, laneValue(field, item));
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
): LaneHead[] {
  if (by === 'field' && !field?.readOnly && field?.kind === 'person')
    return personLanes(field, item);
  if (by === 'field' && !field?.readOnly && field?.kind === 'card')
    return cardLanes(field, item, items, types);
  return [laneOf(by, item, types, statusNames, field)];
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

// Choice: option order, then others A to Z. Checkbox: Yes first. Number: lowest first. Date: earliest first
// (ISO strings sort as dates). Text and labels: A to Z ignoring case.
function fieldLaneOrder(field: LaneField, a: unknown, b: unknown): number {
  if (field.kind === 'checkbox') return Number(b === true) - Number(a === true);
  if (field.kind === 'number' || field.kind === 'percent') return Number(a) - Number(b);
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
): LaneGroups {
  const field = swimlaneBy === 'field' ? laneFieldOf(swimlaneField, types) : undefined;
  const by: SwimlaneBy = swimlaneBy === 'field' && !field ? 'none' : swimlaneBy;
  const laneMap = new Map<string, LaneHead>();
  const lanesOfItem = new Map<string, readonly string[]>();
  for (const it of list) {
    const heads = lanesOf(by, it, items, types, statusNames, field);
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
    laneMap.set(NO_LANE, lanesOf(by, { fields: {} } as Item, items, types, statusNames, field)[0]!);
  const lanes = [...laneMap.values()].sort(laneSort(by, items, types, statusNames, field));
  return { by, field, lanes, lanesOfItem };
}

export function projectBoard(
  setup: PlanBoardSetup,
  items: ReadonlyMap<string, Item>,
  quick?: QuickFilter,
  // The project's type catalogue (docs/specs/026-plan/item-types.md): the order and names of type rows.
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
  // Sort Cards: stable, so rank still orders the cards each level ties.
  const sorted = !!setup.sortBy?.length;
  if (sorted) scoped.sort(boardSortComparator(setup.sortBy!, types));
  unplaced.sort((a, b) => a.key - b.key);

  const groups = boardLanes(setup, scoped, items, types, statusNames);
  const { by, lanes } = groups;

  // Cards in every done column (docs/specs/026-plan/plan-board.md "Done columns").
  let doneCount = 0;
  const columns: ProjectedColumn[] = setup.columns.map((column) => {
    const all =
      archiveBoard || allBoard
        ? column === setup.columns[0]
          ? scoped
          : []
        : scoped.filter((it) => itemStatus(it) === column.status);
    if (isDoneColumn(setup, column)) doneCount += all.length;
    const shown = all.filter((it) => quickFilterMatches(quick, it, types));
    // One pass files each card into every lane it sits in (several, for a field that holds several), in order.
    const byLane = new Map<string, Item[]>(lanes.map((l) => [l.key, []]));
    for (const it of shown)
      for (const key of groups.lanesOfItem.get(it.id)!) byLane.get(key)!.push(it);
    return {
      column,
      count: all.length,
      overLimit: column.wipLimit !== undefined && all.length > column.wipLimit,
      lanes: lanes.map((l) => ({ laneKey: l.key, items: byLane.get(l.key)! })),
    };
  });
  return {
    columns,
    lanes,
    swimlanes: by !== 'none',
    unplaced,
    doneCount,
    total: scoped.length,
    ...(sorted ? { sorted } : {}),
  };
}

// Face-down while the board hides writing and the viewer did not write it.
export function cardIsFaceDown(
  item: Item,
  setup: Pick<PlanBoardSetup, 'hideWriting'>,
  viewerId: string,
): boolean {
  return setup.hideWriting && item.createdBy.id !== viewerId;
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
    const { id, status: rawStatus, name, wipLimit, color } = c;
    if (typeof id !== 'string' || !id || id.length > 40 || seenIds.has(id)) continue;
    if (typeof rawStatus !== 'string' || !rawStatus.trim() || rawStatus.length > ITEM_STATUS_MAX)
      continue;
    // Trimmed, as every card's status is (fields.ts), so a card moved into the column lands in it.
    const status = rawStatus.trim();
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
    const done = (c as { done?: unknown }).done;
    if (typeof done === 'boolean') col.done = done;
    columns.push(col);
  }
  // No columns is a board waiting for its first (docs/specs/026-plan/plan-board.md "The board set-up").
  // Every board shows every card (docs/specs/026-plan/plan-board.md): a `scope` an older board stored is
  // read past.
  // Boards had their own voting once; a vote is now the tab's session vote on the cards
  // (docs/specs/012-collaboration/session-tools.md "Voting on Plan cards"), so a stored `voting` is read past.
  // Parent was a grouping of its own; it is a Card field now, so a board grouped by it groups by that field.
  const legacyParent = input['swimlaneBy'] === LEGACY_PARENT_GROUPING;
  let swimlaneBy = legacyParent
    ? 'field'
    : (SWIMLANE_BY as readonly unknown[]).includes(input['swimlaneBy'])
      ? (input['swimlaneBy'] as SwimlaneBy)
      : 'none';
  // A field lane keeps its field id while it is one a lane could name; the field itself may come and go.
  const laneField = legacyParent ? PARENT_FIELD_ID : input['swimlaneField'];
  const swimlaneField =
    swimlaneBy === 'field' &&
    typeof laneField === 'string' &&
    ((LANE_FIELD_BUILT_INS as readonly string[]).includes(laneField) ||
      isStampField(laneField) ||
      CUSTOM_FIELD_ID_PATTERN.test(laneField))
      ? laneField
      : undefined;
  if (swimlaneBy === 'field' && !swimlaneField) swimlaneBy = 'none';
  // A board's columns are its statuses, so rows by status would repeat them: only an All Cards board (one column,
  // every status) groups by status (docs/specs/026-plan/plan-board.md "Swimlanes"). Another board stored grouping by
  // status reads as no grouping.
  if (swimlaneBy === 'status' && input['allCards'] !== true) swimlaneBy = 'none';
  const sortBy = normaliseBoardSort(input['sortBy']);
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
    ...(sortBy ? { sortBy } : {}),
    cardFields,
    ...(readBoardWidgets(input['widgets']) ? { widgets: readBoardWidgets(input['widgets']) } : {}),
    ...(input['archive'] === true ? { archive: true } : {}),
    ...(input['allCards'] === true ? { allCards: true } : {}),
    ...(readAddTypes(input['addTypes']) ? { addTypes: readAddTypes(input['addTypes']) } : {}),
    // Detailed is stored as absent; a retired Compact board reads as Detailed.
    ...(readCardSize(input['cardSize']) === 'minimal' ? { cardSize: 'minimal' as const } : {}),
    hideWriting: input['hideWriting'] === true,
    ...(input['fillTab'] === true ? { fillTab: true } : {}),
    ...((LINKED_RECORD_KINDS as readonly unknown[]).includes(input['collects'])
      ? { collects: input['collects'] as LinkedRecordKind }
      : {}),
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
