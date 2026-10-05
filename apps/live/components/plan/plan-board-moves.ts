// What a card dropped on a Plan board does (docs/specs/025-plan/plan-board.md "Moving cards"), as
// pure functions of the board: the move a drop makes (its column, its place, and its row's field when
// the board has rows).
import {
  type BoardProjection,
  type Item,
  type ItemMove,
  type LaneHead,
  type PlanBoardSetup,
} from '@livediagram/items';
import type { PlanDropSlot } from '@/hooks/plan/usePlanCardDrag';

// The fields a row stands for, set on a card dropped into it.
// The status a card in a cell has (docs/specs/025-plan/plan-board.md "All Cards"): its column's, or on an
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

export function laneMove(lane: LaneHead | undefined): Pick<ItemMove, 'set' | 'clear' | 'type'> {
  // A status row moves the card by its status, which the move itself carries.
  if (!lane || !lane.field || lane.field === 'status') return {};
  if (lane.field === 'type') return typeof lane.value === 'string' ? { type: lane.value } : {};
  return lane.value === null ? { clear: [lane.field] } : { set: { [lane.field]: lane.value } };
}

// The row the board shows an item in, or undefined when the board does not show it.
export function laneOfItem(projection: BoardProjection, itemId: string): string | undefined {
  for (const c of projection.columns)
    for (const l of c.lanes) if (l.items.some((i) => i.id === itemId)) return l.laneKey;
  return undefined;
}

// The card after an item in its cell, or null at the end (or when the board does not show it).
export function nextInCell(projection: BoardProjection, itemId: string): string | null {
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
  const withLanes = setup.swimlaneBy !== 'none';
  const lane = projection.lanes.find((l) => l.key === slot.laneKey);
  const currentLane = laneOfItem(projection, itemId);
  const shown = currentLane !== undefined;
  const status = cellStatus(setup, slot.status, lane);
  const sameCell =
    shown && item?.fields['status'] === status && (!withLanes || currentLane === slot.laneKey);
  if (sameCell && slot.beforeId === nextInCell(projection, itemId)) return null;
  // An All Cards board with no status row under the drop leaves the card's status as it is.
  if (setup.allCards && status === slot.status && typeof item?.fields['status'] === 'string') {
    return { status: item.fields['status'], before: slot.beforeId };
  }
  return {
    status,
    before: slot.beforeId,
    ...(withLanes && currentLane !== slot.laneKey ? laneMove(lane) : {}),
  };
}
