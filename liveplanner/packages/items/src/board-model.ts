// The Plan board set-up's shapes and the small item predicates every board reads (docs/specs/026-plan/plan-board.md).
// board.ts re-exports them.

import type { BoardWidgetId } from './board-widgets';
import type { BoardSortLevel } from './board-sort';
import type { CardSearchFilter } from './card-search';
import type { SavedBoardFilter } from './saved-filters';
import type { Item } from './item';
import { ARCHIVED_FIELD, itemStatus } from './item';
import type { PARENT_FIELD_ID } from './item-types';
import type { Priority } from './fields';
import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';

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
  widgets?: BoardWidgetId[];
  hideWriting: boolean;
  // Fill Tab (docs/specs/026-plan/plan-board.md "Fill Tab"): the board fills its tab for everyone, every time the tab
  // is shown, and the rest of the canvas cannot be used. Absent is off.
  fillTab?: boolean;
  // A linked board (docs/specs/026-plan/linked-boards.md): the kind of canvas record it collects. Absent is none.
  collects?: LinkedRecordKind;
  // Saved filters (docs/specs/026-plan/board-widgets.md "Saved filters"): named quick filters everyone may apply,
  // at most SAVED_FILTERS_MAX. Absent is none.
  savedFilters?: SavedBoardFilter[];
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
  // The Filter widget's field chips (docs/specs/026-plan/board-widgets.md "The Filter widget"): Card Search's filters,
  // every one of which a card must match.
  filters?: CardSearchFilter[];
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
