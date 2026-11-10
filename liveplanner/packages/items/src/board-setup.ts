// A Plan board set-up read from storage, and what a set-up decides on its own: its size, the card types it shows,
// its swimlane groupings (docs/specs/026-plan/plan-board.md "The board set-up"). board.ts re-exports them.

import { readBoardWidgets } from './board-widgets';
import { readSavedFilters } from './saved-filters';
import type { Item } from './item';
import { LANE_FIELD_BUILT_INS } from './item';
import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';
import { normaliseBoardSort } from './board-sort';
import { LEGACY_PARENT_GROUPING, PARENT_FIELD_ID, type ItemTypeDef } from './item-types';
import {
  ITEM_STATUS_MAX,
  ITEM_TYPE_PATTERN,
  PLAN_COLUMNS_MAX,
  PLAN_COLUMN_NAME_MAX,
  PLAN_TITLE_MAX,
  PLAN_WIP_MAX,
} from './limits';
import { HEX_COLOUR, isObj } from './validate';
import { isStampField } from './card-stamps';
import {
  CARD_FIELDS,
  LINKED_RECORD_KINDS,
  SWIMLANE_BY,
  readCardSize,
  type CardField,
  type LinkedRecordKind,
  type PlanBoardSetup,
  type PlanColumn,
  type SwimlaneBy,
} from './board-model';

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
  // The cap counts columns kept, not entries read: a valid column after a dropped one is still kept.
  for (const c of input['columns'] as unknown[]) {
    if (columns.length >= PLAN_COLUMNS_MAX) break;
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
    ...(readSavedFilters(input['savedFilters'])
      ? { savedFilters: readSavedFilters(input['savedFilters']) }
      : {}),
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
