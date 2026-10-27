// What a card dropped on a Plan board does (docs/specs/026-plan/plan-board.md "Moving cards"), as
// pure functions of the board: the move a drop makes (its column, its place, and its row's field when
// the board has rows).
import {
  boardSortComparator,
  laneDropPatch,
  type BoardProjection,
  type ItemTypeDef,
  type Item,
  type ItemMove,
  type LaneHead,
  type PlanBoardSetup,
} from '@liveplanner/items';
import type { PlanDropSlot } from '@/hooks/plan/usePlanCardDrag';

// The fields a row stands for, set on a card dropped into it.
// The status a card in a cell has (docs/specs/026-plan/plan-board.md "All Cards"): its column's, or on an
// All Cards board, its status row's.
export function cellStatus(
  setup: PlanBoardSetup,
  columnStatus: string,
  lane: LaneHead | undefined,
): string {
  return setup.allCards && lane?.field === 'status' && typeof lane.value === 'string'
    ? lane.value
    : columnStatus;
}

// What a drop into a row sets on the card (or on a new card, `item` absent): the shared rule in
// @liveplanner/items. A status row moves the card by its status, which the move itself carries.
export function laneMove(
  lane: LaneHead | undefined,
  item?: Pick<Item, 'fields'>,
): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  return laneDropPatch(lane, item);
}

// The row the board shows an item in, or undefined when the board does not show it.
export function laneOfItem(projection: BoardProjection, itemId: string): string | undefined {
  for (const c of projection.columns)
    for (const l of c.lanes) if (l.items.some((i) => i.id === itemId)) return l.laneKey;
  return undefined;
}

// The card after an item in its cell, or null at the end (or when the board does not show it).
function nextInCell(projection: BoardProjection, itemId: string): string | null {
  for (const c of projection.columns)
    for (const l of c.lanes) {
      const i = l.items.findIndex((x) => x.id === itemId);
      if (i >= 0) return l.items[i + 1]?.id ?? null;
    }
  return null;
}

// The move a drop at `slot` makes, or null when the card would land where it already is. A card
// from another board is not on this one, so it always moves, and takes the row's field.
export function boardMoveFor(
  setup: PlanBoardSetup,
  projection: BoardProjection,
  item: Item | undefined,
  itemId: string,
  slot: PlanDropSlot,
): ItemMove | null {
  const withLanes = projection.swimlanes;
  const lane = projection.lanes.find((l) => l.key === slot.laneKey);
  const currentLane = laneOfItem(projection, itemId);
  const shown = currentLane !== undefined;
  const status = cellStatus(setup, slot.status, lane);
  const sameCell =
    shown && item?.fields['status'] === status && (!withLanes || currentLane === slot.laneKey);
  if (sameCell && slot.beforeId === nextInCell(projection, itemId)) return null;
  // A sorted board is not reordered by hand: a card let go in its own cell stays where the sort puts it.
  if (sameCell && projection.sorted) return null;
  // An All Cards board with no status row under the drop leaves the card's status as it is.
  if (setup.allCards && status === slot.status && typeof item?.fields['status'] === 'string') {
    return { status: item.fields['status'], before: slot.beforeId };
  }
  return {
    status,
    before: slot.beforeId,
    ...(withLanes && currentLane !== slot.laneKey ? laneMove(lane, item) : {}),
  };
}

// On a sorted board, the slot where the sort puts `item` once it lands in `slot`'s cell (its status, and its row's
// field and type, applied first): before the first card of the cell it sorts ahead of, else at the end. A board in
// hand order, or a card it does not know, keeps the slot as given.
export function sortedSlot(
  setup: PlanBoardSetup,
  projection: BoardProjection,
  item: Item | undefined,
  slot: PlanDropSlot,
  types: readonly ItemTypeDef[],
): PlanDropSlot {
  if (!projection.sorted || !setup.sortBy || !item) return slot;
  const lane = projection.lanes.find((l) => l.key === slot.laneKey);
  const patch = projection.swimlanes ? laneMove(lane, item) : {};
  const fields: Item['fields'] = {
    ...item.fields,
    status: cellStatus(setup, slot.status, lane),
    ...patch.set,
  };
  for (const key of patch.clear ?? []) delete fields[key];
  const landed: Item = { ...item, type: patch.type ?? item.type, fields };
  const cell =
    projection.columns
      .find((c) => c.column.status === slot.status)
      ?.lanes.find((l) => l.laneKey === slot.laneKey)
      ?.items.filter((x) => x.id !== item.id) ?? [];
  const compare = boardSortComparator(setup.sortBy, types);
  return { ...slot, beforeId: cell.find((x) => compare(landed, x) < 0)?.id ?? null };
}
