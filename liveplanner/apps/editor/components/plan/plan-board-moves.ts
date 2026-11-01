// What a card dropped on a Plan board does (docs/specs/026-plan/plan-board.md "Moving cards"), as
// pure functions of the board: the move a drop makes (its column, its place, and its row's field when
// the board has rows).
import {
  ARCHIVED_FIELD,
  boardSortComparator,
  groupMoves,
  isArchived,
  laneDropPatch,
  type ItemMoveOf,
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
// @liveplanner/items. A status row moves the card by its status, which the move itself carries. `from` is the row
// the card left, so a field holding several swaps that row's value for this one's (item-types.md "Holds Several").
export function laneMove(
  lane: LaneHead | undefined,
  item?: Pick<Item, 'fields'>,
  from?: LaneHead,
): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  return laneDropPatch(lane, item, from);
}

// The row the board shows an item in, or undefined when the board does not show it: `prefer` when the item sits there
// (a card holding several values sits in several rows; the drag names the one it was picked up in), else the first.
export function laneOfItem(
  projection: BoardProjection,
  itemId: string,
  prefer?: string,
): string | undefined {
  let first: string | undefined;
  for (const c of projection.columns)
    for (const l of c.lanes)
      if (l.items.some((i) => i.id === itemId)) {
        if (l.laneKey === prefer) return prefer;
        first ??= l.laneKey;
      }
  return first;
}

// The card after an item in its cell (in `laneKey`, when given), or null at the end (or when the board does not show
// it).
function nextInCell(projection: BoardProjection, itemId: string, laneKey?: string): string | null {
  for (const c of projection.columns)
    for (const l of c.lanes) {
      if (laneKey !== undefined && l.laneKey !== laneKey) continue;
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
  // The row the card was picked up in, when the drag knows it.
  fromLane?: string,
): ItemMove | null {
  const withLanes = projection.swimlanes;
  const lane = projection.lanes.find((l) => l.key === slot.laneKey);
  const currentLane = laneOfItem(projection, itemId, fromLane);
  const shown = currentLane !== undefined;
  const status = cellStatus(setup, slot.status, lane);
  const sameCell =
    shown && item?.fields['status'] === status && (!withLanes || currentLane === slot.laneKey);
  if (sameCell && slot.beforeId === nextInCell(projection, itemId, currentLane)) return null;
  // A sorted board is not reordered by hand: a card let go in its own cell stays where the sort puts it.
  if (sameCell && projection.sorted) return null;
  // An All Cards board with no status row under the drop leaves the card's status as it is.
  if (setup.allCards && status === slot.status && typeof item?.fields['status'] === 'string') {
    return { status: item.fields['status'], before: slot.beforeId };
  }
  return {
    status,
    before: slot.beforeId,
    ...(withLanes && currentLane !== slot.laneKey
      ? laneMove(
          lane,
          item,
          projection.lanes.find((l) => l.key === currentLane),
        )
      : {}),
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

// A group of selected cards let go at `slot` (docs/specs/026-plan/plan-board.md "Several cards at once"): one chain of
// moves landing them together, in the order given, before the first card at or after the slot's neighbour that is not
// one of them (the end of the cell when there is none). Each card changing row takes the row's field; a card coming off
// an Archive board is restored in the same move. `refused` names the cards whose type leaves the cell's status out:
// they stay where they are.
export function groupDropMoves(
  setup: PlanBoardSetup,
  projection: BoardProjection,
  items: ReadonlyMap<string, Item>,
  ids: readonly string[],
  slot: PlanDropSlot,
  refused: (item: Item, move: ItemMove) => boolean,
): { moves: ItemMoveOf[]; stayed: number } {
  const lane = projection.lanes.find((l) => l.key === slot.laneKey);
  const status = cellStatus(setup, slot.status, lane);
  const group = new Set(ids);
  const cell =
    projection.columns
      .find((c) => c.column.status === slot.status)
      ?.lanes.find((l) => l.laneKey === slot.laneKey)?.items ?? [];
  const at = slot.beforeId ? cell.findIndex((i) => i.id === slot.beforeId) : -1;
  const before = at < 0 ? null : (cell.slice(at).find((i) => !group.has(i.id))?.id ?? null);
  const perCard = (id: string): Pick<ItemMove, 'set' | 'clear' | 'type'> => {
    const item = items.get(id);
    const from = laneOfItem(projection, id);
    const lanePatch =
      projection.swimlanes && from !== slot.laneKey
        ? laneMove(
            lane,
            item,
            projection.lanes.find((l) => l.key === from),
          )
        : {};
    if (!item || !isArchived(item)) return lanePatch;
    return { ...lanePatch, clear: [...(lanePatch.clear ?? []), ARCHIVED_FIELD] };
  };
  const landing: string[] = [];
  let stayed = 0;
  for (const id of ids) {
    const item = items.get(id);
    if (!item) continue;
    const patch = perCard(id);
    if (refused(item, { status, ...(patch.type ? { type: patch.type } : {}) })) stayed += 1;
    else landing.push(id);
  }
  return { moves: groupMoves(landing, { status, before }, perCard), stayed };
}
