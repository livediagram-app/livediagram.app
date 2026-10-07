// The boards a card can be dropped on (docs/specs/026-plan/plan-board.md "Moving cards"): each Plan
// board on screen registers itself by its element id, so a card dragged off one board can land on
// another. The board under the pointer is read from the DOM (`data-plan-board`), as the drop slot
// is, so the hit test can never disagree with what is drawn. Only the active tab's boards are on
// screen, so the registry never holds a board the pointer could not reach.
import type { BoardWidgetKind, Item } from '@livediagram/items';
import type { PlanDropSlot } from './usePlanCardDrag';

// What a board under a dragged card shows: the slot it would land in, with the gap's height. `refused` is a palette
// card of a type the board does not show: the gap is red and says why (docs/specs/026-plan/plan-mode.md).
export type PlanIncoming = { itemId: string; slot: PlanDropSlot; height: number; refused?: string };

// Whether two hovers draw the same gap: a card held still over a slot hovers again on every pointermove,
// and the board keeps its state (no re-render) while nothing it draws has changed.
export function sameIncoming(a: PlanIncoming | null, b: PlanIncoming | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.itemId === b.itemId &&
    a.slot.status === b.slot.status &&
    a.slot.laneKey === b.slot.laneKey &&
    a.slot.beforeId === b.slot.beforeId &&
    a.height === b.height &&
    a.refused === b.refused
  );
}

export type WidgetPlaced = 'added' | 'moved' | 'already' | 'refused';

export type PlanBoardTarget = {
  // Whether the board shows this item at all (its scope); a card it would hide is refused.
  accepts: (itemId: string) => boolean;
  // Why a refused card cannot land, for the announcement ("This board shows bugs only").
  refusal: () => string;
  drop: (itemId: string, slot: PlanDropSlot) => void;
  hover: (incoming: PlanIncoming | null) => void;
  // A card from the palette (docs/specs/026-plan/plan-mode.md "The palette"): whether the board shows
  // that type, and a new item of it made at the slot (its row's field set).
  acceptsType: (type: string) => boolean;
  addCard: (type: string, slot: PlanDropSlot) => void;
  // A card moved to `slot`: the refusal when its type (or the type its swimlane gives it) leaves the slot's status
  // out (docs/specs/026-plan/item-types.md "An item type"), else null. Never a refusal for the status it is in.
  refuseAt: (item: Pick<Item, 'type' | 'fields'>, slot: PlanDropSlot) => string | null;
  // A widget from the palette (docs/specs/026-plan/board-widgets.md): whether this viewer may arrange
  // the board's widgets, the place a dragged one would land (null: none), and one placed there.
  canEditWidgets: () => boolean;
  widgetHover: (slot: number | null) => void;
  // What happened: added, moved (the board had it), or already there (a tap, which never moves one).
  placeWidget: (kind: BoardWidgetKind, slot: number, opts?: { tap?: boolean }) => WidgetPlaced;
};

const targets = new Map<string, PlanBoardTarget>();

export function registerPlanBoardTarget(boardId: string, target: PlanBoardTarget): () => void {
  targets.set(boardId, target);
  return () => {
    if (targets.get(boardId) === target) targets.delete(boardId);
  };
}

// The boards on screen, by element id.
export function planBoardIds(): string[] {
  return [...targets.keys()];
}

export function planBoardTarget(boardId: string): PlanBoardTarget | undefined {
  return targets.get(boardId);
}

// The registered board under a screen point other than `exceptId` (none: any board), with its root.
export function otherPlanBoardAt(
  clientX: number,
  clientY: number,
  exceptId: string,
): { id: string; el: HTMLElement } | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof HTMLElement)) continue;
    const root = el.closest<HTMLElement>('[data-plan-board]');
    const id = root?.dataset.planBoard;
    if (root && id && id !== exceptId && targets.has(id)) return { id, el: root };
  }
  return null;
}
