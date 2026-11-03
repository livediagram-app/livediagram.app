'use client';

// Picking a card up on a Plan board (docs/specs/026-plan/blueprints/plan-board.md "Behaviour and
// state"): idle, pressed, dragging, then dropped or cancelled. A press that never moves is a click
// (open the item). While dragging, a copy follows the pointer and the slot it would land in is
// read from the board's own DOM under the pointer: the column (`data-plan-status`), the row
// (`data-plan-lane`) and the cards there (`data-plan-card`), so the hit test can never disagree
// with what is drawn. A drop on another board moves the item there (its column, and its row when
// that board has rows); a drop on the canvas leaves a Plan card there.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isDragTravel } from '@liveworkspace/workbench/lib/press-gestures';
import type { Item } from '@liveplanner/items';
import { otherPlanBoardAt, planBoardTarget } from './plan-board-targets';
import { CARD_HOLD_TO_DRAG_MS, holdPhase } from '@/components/plan/phone-board';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type PlanDropSlot = {
  status: string;
  laneKey: string;
  // The card the dragged one lands before, or null for the end of the cell.
  beforeId: string | null;
};

export type PlanDragState = {
  itemId: string;
  clientX: number;
  clientY: number;
  // Where on the card it was held, and its size on screen, for the floating copy.
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  slot: PlanDropSlot | null;
  outside: boolean;
  // Another board under the pointer: its element id, and whether it shows this item.
  target: { boardId: string; accepts: boolean } | null;
  // Why the slot under the pointer refuses the card: its type leaves the column's status out
  // (docs/specs/026-plan/item-types.md "An item type"). The slot then sits at the column's foot, drawn red.
  refused?: string;
  // Over the Trash button (docs/specs/026-plan/items.md "Trash"): letting go trashes the card.
  overTrash?: boolean;
  // A group of selected cards carried together, in board order, the held one among them
  // (docs/specs/026-plan/plan-board.md "Several cards at once").
  group?: readonly string[];
};

type Rect = { left: number; top: number; right: number; bottom: number };
const inRect = (x: number, y: number, r: Rect) =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

// Where a carried card's pointer is: over the Trash, else inside its board or outside it. The Trash is asked first:
// a maximised or tab-filling board runs under the bottom-right controls (canvas-layer-insets.ts), so the drop target
// floats over the board, and a pointer on it is over the Trash, not over the board (no slot opens under it).
export function dragPlace(
  x: number,
  y: number,
  board: Rect,
  trash: readonly Rect[],
): { outside: boolean; overTrash: boolean } {
  const overTrash = trash.some((r) => inRect(x, y, r));
  return { overTrash, outside: overTrash || !inRect(x, y, board) };
}

// The Trash drop targets on screen (one while a card is dragged, in the bottom-right strip).
function trashRects(): Rect[] {
  return [...document.querySelectorAll<HTMLElement>('[data-plan-trash]')].map((el) =>
    el.getBoundingClientRect(),
  );
}

// The pointer's place while a card is dragged, apart from the drag state: the floating copy follows it
// every frame, while the board re-renders only when the slot (or target) under the pointer changes.
export type PlanDragPointer = { clientX: number; clientY: number };
export type PlanDragPointerStore = {
  get: () => PlanDragPointer | null;
  subscribe: (listener: () => void) => () => void;
};

function createPointerStore(): PlanDragPointerStore & { set: (p: PlanDragPointer | null) => void } {
  let current: PlanDragPointer | null = null;
  const listeners = createListeners();
  return {
    get: () => current,
    set: (p) => {
      current = p;
      listeners.notify();
    },
    subscribe: listeners.subscribe,
  };
}

export function usePlanDragPointer(store: PlanDragPointerStore): PlanDragPointer | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// Whether the drag state differs from the last one in anything but the pointer's place.
export function samePlanDragTarget(a: PlanDragState | null, b: PlanDragState): boolean {
  if (!a) return false;
  return (
    a.itemId === b.itemId &&
    a.outside === b.outside &&
    !!a.overTrash === !!b.overTrash &&
    a.slot?.status === b.slot?.status &&
    a.slot?.laneKey === b.slot?.laneKey &&
    a.slot?.beforeId === b.slot?.beforeId &&
    (a.slot === null) === (b.slot === null) &&
    a.target?.boardId === b.target?.boardId &&
    a.target?.accepts === b.target?.accepts &&
    a.refused === b.refused
  );
}

type Pressed = {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  rect: DOMRect;
  // The row the card was picked up in (`data-plan-lane`): a card holding several values sits in several rows, and a
  // drop swaps the value of the row it left (docs/specs/026-plan/item-types.md "Holds Several").
  fromLane: string | undefined;
  // A touch press on a phone board's card is carried only once held still this long (performance.now()); null
  // carries it on its first travel past the slop (components/plan/phone-board.ts holdPhase).
  holdUntil: number | null;
  // The group the press carries, when it is on one of two or more selected cards.
  group?: readonly string[];
  // Where the card is now: its cell and the card after it (null at the cell's end). A drop there changes nothing, so
  // no gap opens there (homeSlot).
  home?: PlanCardHome;
};

export type PlanCardHome = { status: string; laneKey: string; nextId: string | null };

// The card's own place, read from the board's DOM as it is pressed: its cell and the card drawn after it.
export function planCardHome(card: HTMLElement): PlanCardHome | undefined {
  const cell = card.closest<HTMLElement>('[data-plan-status]');
  const id = card.dataset.planCard;
  if (!cell || !id || cell.dataset.planStatus === undefined) return undefined;
  const ids = [...cell.querySelectorAll<HTMLElement>('[data-plan-card]')].map(
    (c) => c.dataset.planCard,
  );
  const at = ids.indexOf(id);
  if (at < 0) return undefined;
  return {
    status: cell.dataset.planStatus,
    laneKey: cell.dataset.planLane ?? '',
    nextId: ids[at + 1] ?? null,
  };
}

// Whether a slot is the card's own place, where a drop changes nothing (docs/specs/026-plan/plan-board.md "No gap where
// the card already is"): its own cell, just before the card after it (so alone in its cell, anywhere in it). On a
// sorted board (`sorted`: the sort placed the slot) the sort puts it back where it is, so its whole cell is home.
export function isHomeSlot(
  slot: PlanDropSlot,
  home: PlanCardHome | undefined,
  sorted: boolean,
): boolean {
  if (!home || slot.status !== home.status || slot.laneKey !== home.laneKey) return false;
  return sorted || slot.beforeId === home.nextId;
}

// When the held-to-drag press under the finger may be carried (performance.now()), or null: one finger carries one
// card, so one for every board.
let heldUntil: number | null = null;

// A phone board's card's own non-passive touchmove (a listener there from the start, so the browser waits on it):
// once the card's hold is up its finger carries the card, so the board's own scroll under it is stopped.
export function holdCardTouch(e: TouchEvent): void {
  if (heldUntil !== null && e.cancelable && performance.now() >= heldUntil) e.preventDefault();
}

// Whether the finger's held-to-drag press is held long enough to carry its card (now or already): a phone board's
// sideways swipe (usePhoneColumnSwipe) then stands down, so the pager never fights a card's drag.
export function cardHeld(): boolean {
  return heldUntil !== null && performance.now() >= heldUntil;
}

// The slot to keep while no cell is under the pointer (a gutter between columns, a column's head, a lane's heading,
// the board's header): the last one, when it was on the same board, with its refusal. Without it the gap would close
// as the pointer crossed into the next column and open again there, the column it left shrinking and growing back
// (docs/specs/026-plan/plan-board.md "A steady drag"). `otherId` is the accepting other board under the pointer.
export function keptPlanDropSlot(
  prev: PlanDragState | null,
  outside: boolean,
  otherId: string | null,
): { slot: PlanDropSlot; refused?: string } | null {
  if (!prev?.slot) return null;
  const sameBoard = outside
    ? !!otherId && prev.outside && prev.target?.boardId === otherId && prev.target.accepts
    : !prev.outside;
  if (!sameBoard) return null;
  return { slot: prev.slot, ...(prev.refused ? { refused: prev.refused } : {}) };
}

// The slot under a screen point, inside the board `boardEl`.
export function dropSlotAt(
  boardEl: HTMLElement,
  clientX: number,
  clientY: number,
  // The card carried, or a group's cards: none of them is a slot's neighbour.
  dragged: string | ReadonlySet<string>,
): PlanDropSlot | null {
  const skip = typeof dragged === 'string' ? new Set([dragged]) : dragged;
  const hits = document.elementsFromPoint(clientX, clientY);
  const cell = hits.find(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.dataset.planStatus !== undefined && boardEl.contains(el),
  );
  if (!cell) return null;
  const status = cell.dataset.planStatus!;
  const laneKey = cell.dataset.planLane ?? '';
  const cards = [...cell.querySelectorAll<HTMLElement>('[data-plan-card]')].filter(
    (c) => !skip.has(c.dataset.planCard ?? ''),
  );
  const below = cards.find((c) => {
    const r = c.getBoundingClientRect();
    return clientY < r.top + r.height / 2;
  });
  return { status, laneKey, beforeId: below?.dataset.planCard ?? null };
}

export function usePlanCardDrag(opts: {
  boardRef: React.RefObject<HTMLElement | null>;
  // This board's element id, so another board under the pointer can be told apart from it.
  boardId: string;
  enabled: boolean;
  onClick: (itemId: string) => void;
  onDrop: (itemId: string, slot: PlanDropSlot, fromLane?: string) => void;
  onDropOutside: (itemId: string, clientX: number, clientY: number) => void;
  // A drop on a board that does not show the item: nothing moves; the reason is announced.
  onRefused: (message: string) => void;
  onDragging: (itemId: string | null) => void;
  // The dragged card (its type and status), so a column whose status its type leaves out can refuse it.
  item?: (itemId: string) => Pick<Item, 'type' | 'fields'> | undefined;
  // A card let go over the Trash.
  onTrash?: (itemId: string) => void;
  // A group let go in one of this board's cells, or over the Trash.
  onDropGroup?: (itemIds: readonly string[], slot: PlanDropSlot) => void;
  onTrashGroup?: (itemIds: readonly string[]) => void;
}) {
  const { boardRef, enabled } = opts;
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const pressedRef = useRef<Pressed | null>(null);
  const [drag, setDrag] = useState<PlanDragState | null>(null);
  const dragRef = useRef<PlanDragState | null>(null);
  const [pointer] = useState(createPointerStore);
  // One hit test per animation frame, on the latest move.
  const frameRef = useRef<number | null>(null);
  const latestMoveRef = useRef<PointerEvent | null>(null);

  // Tells the board last hovered that the card has left it.
  const leaveTarget = useCallback(() => {
    const boardId = dragRef.current?.target?.boardId;
    if (boardId) planBoardTarget(boardId)?.hover(null);
  }, []);

  const end = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    latestMoveRef.current = null;
    pointer.set(null);
    leaveTarget();
    pressedRef.current = null;
    heldUntil = null;
    dragRef.current = null;
    setDrag(null);
    optsRef.current.onDragging(null);
  }, [leaveTarget, pointer]);

  useEffect(() => {
    const step = (e: PointerEvent) => {
      const p = pressedRef.current;
      const board = boardRef.current;
      if (!p || e.pointerId !== p.pointerId || !board) return;
      const travelled = isDragTravel(e.clientX - p.startX, e.clientY - p.startY);
      if (!dragRef.current && p.holdUntil !== null) {
        const phase = holdPhase(p.holdUntil, performance.now(), travelled);
        // Moved before the hold was up: the finger is scrolling the board, so the press is neither drag nor click.
        if (phase === 'scroll') {
          pressedRef.current = null;
          heldUntil = null;
          return;
        }
        if (phase === 'wait') return;
      }
      // A press that has not travelled the shared slop is still a click.
      if (!dragRef.current && !travelled) return;
      if (!dragRef.current) optsRef.current.onDragging(p.itemId);
      const { outside, overTrash } = dragPlace(
        e.clientX,
        e.clientY,
        board.getBoundingClientRect(),
        trashRects(),
      );
      const other =
        outside && !overTrash
          ? otherPlanBoardAt(e.clientX, e.clientY, optsRef.current.boardId)
          : null;
      const accepts = !!other && !!planBoardTarget(other.id)?.accepts(p.itemId);
      const carried = p.group ? new Set(p.group) : p.itemId;
      const otherSlot =
        other && accepts ? dropSlotAt(other.el, e.clientX, e.clientY, carried) : null;
      if (dragRef.current?.target && dragRef.current.target.boardId !== other?.id) leaveTarget();
      // The slot under the pointer (where a sorted board's sort puts the card), and whether the card's type refuses
      // its status.
      const slotTarget = planBoardTarget(other ? other.id : optsRef.current.boardId);
      const underPointer = outside ? otherSlot : dropSlotAt(board, e.clientX, e.clientY, carried);
      // No cell under the pointer: the last slot stays (keptPlanDropSlot), already placed and checked.
      const kept = underPointer
        ? null
        : keptPlanDropSlot(dragRef.current, outside, other && accepts ? other.id : null);
      const rawSlot = kept
        ? kept.slot
        : underPointer && slotTarget?.place
          ? slotTarget.place(p.itemId, underPointer)
          : underPointer;
      const dragged = optsRef.current.item?.(p.itemId);
      // A group is checked card by card when it lands (some may stay); a single card shows its refusal here.
      const refused = kept
        ? (kept.refused ?? null)
        : !p.group && dragged && rawSlot && slotTarget
          ? slotTarget.refuseAt(dragged, rawSlot)
          : null;
      const placed = rawSlot && refused ? { ...rawSlot, beforeId: null } : rawSlot;
      // Its own place on its own board (one card, not a group): no slot, so no gap, and letting go does nothing.
      const sorted = !kept && !!underPointer && rawSlot !== underPointer;
      const slot =
        placed && !outside && !p.group && isHomeSlot(placed, p.home, sorted) ? null : placed;
      if (other && slot) {
        planBoardTarget(other.id)?.hover({
          itemId: p.itemId,
          slot,
          height: p.rect.height,
          ...(refused ? { refused } : {}),
        });
      } else if (other) planBoardTarget(other.id)?.hover(null);
      const next: PlanDragState = {
        itemId: p.itemId,
        clientX: e.clientX,
        clientY: e.clientY,
        offsetX: p.startX - p.rect.left,
        offsetY: p.startY - p.rect.top,
        width: p.rect.width,
        height: p.rect.height,
        slot,
        outside,
        target: other ? { boardId: other.id, accepts } : null,
        ...(refused ? { refused } : {}),
        ...(overTrash ? { overTrash: true } : {}),
        ...(p.group ? { group: p.group } : {}),
      };
      pointer.set({ clientX: e.clientX, clientY: e.clientY });
      const changed = !samePlanDragTarget(dragRef.current, next);
      dragRef.current = next;
      if (changed) setDrag(next);
    };
    const onMove = (e: PointerEvent) => {
      const p = pressedRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      latestMoveRef.current = e;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const latest = latestMoveRef.current;
        latestMoveRef.current = null;
        if (latest) step(latest);
      });
    };
    const onUp = (e: PointerEvent) => {
      const p = pressedRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      // The last move not yet stepped is stepped now, so the drop lands where the pointer let go.
      if (latestMoveRef.current) {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        step(latestMoveRef.current);
        latestMoveRef.current = null;
      }
      const d = dragRef.current;
      const target = d?.target ? planBoardTarget(d.target.boardId) : undefined;
      if (!d) optsRef.current.onClick(p.itemId);
      else if (d.group) dropGroup(d, d.group);
      else if (d.overTrash && optsRef.current.onTrash) optsRef.current.onTrash(d.itemId);
      else if (d.refused) optsRef.current.onRefused(d.refused);
      else if (d.target && target) {
        if (!d.target.accepts) optsRef.current.onRefused(target.refusal());
        else if (d.slot) target.drop(d.itemId, d.slot);
      } else if (d.outside) optsRef.current.onDropOutside(d.itemId, e.clientX, e.clientY);
      else if (d.slot) optsRef.current.onDrop(d.itemId, d.slot, p.fromLane);
      end();
    };
    // A group let go: over the Trash, on another board, off every board (nothing moves), or in one of this board's
    // cells.
    const dropGroup = (d: PlanDragState, group: readonly string[]) => {
      const o = optsRef.current;
      const target = d.target ? planBoardTarget(d.target.boardId) : undefined;
      if (d.overTrash) o.onTrashGroup?.(group);
      else if (d.target && target) {
        if (!d.target.accepts) o.onRefused(target.refusal());
        else if (d.slot) target.dropMany?.(group, d.slot);
      } else if (d.outside) o.onRefused('Drop the cards on a board');
      else if (d.slot) o.onDropGroup?.(group, d.slot);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pressedRef.current) {
        e.stopPropagation();
        end();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [boardRef, end, leaveTarget, pointer]);

  // A press on a card: taken from the canvas (no board drag, no selection change).
  const onCardPointerDown = useCallback(
    (
      itemId: string,
      e: React.PointerEvent<HTMLElement>,
      holdToDrag = false,
      // The selected cards in board order, when the press is on one of two or more of them: they move together.
      group?: readonly string[],
    ) => {
      if (!enabled || e.button !== 0) return;
      e.stopPropagation();
      pressedRef.current = {
        itemId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        rect: e.currentTarget.getBoundingClientRect(),
        fromLane: e.currentTarget.closest<HTMLElement>('[data-plan-lane]')?.dataset.planLane,
        holdUntil:
          holdToDrag && e.pointerType === 'touch' ? performance.now() + CARD_HOLD_TO_DRAG_MS : null,
        ...(group && group.length > 1 ? { group } : {}),
      };
      if (!pressedRef.current.group) {
        const home = planCardHome(e.currentTarget);
        if (home) pressedRef.current.home = home;
      }
      heldUntil = pressedRef.current.holdUntil;
    },
    [enabled],
  );

  // `cancelPress` drops a press before it becomes a drag or a click (a long-press opened the card's menu).
  return { drag, pointer, onCardPointerDown, cancelPress: end };
}
