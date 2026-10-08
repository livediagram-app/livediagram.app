'use client';

// Picking a card up on a Plan board (docs/specs/026-plan/blueprints/plan-board.md "Behaviour and
// state"): idle, pressed, dragging, then dropped or cancelled. A press that never moves is a click
// (open the item). While dragging, a copy follows the pointer and the slot it would land in is
// read from the board's own DOM under the pointer: the column (`data-plan-status`), the row
// (`data-plan-lane`) and the cards there (`data-plan-card`), so the hit test can never disagree
// with what is drawn. A drop on another board moves the item there (its column, and its row when
// that board has rows); a drop on the canvas leaves a Plan card there.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isDragTravel } from '@/lib/press-gestures';
import type { Item } from '@livediagram/items';
import { otherPlanBoardAt, planBoardTarget } from './plan-board-targets';

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
};

// Whether a screen point is over the Trash button.
export function trashAt(clientX: number, clientY: number): boolean {
  return document
    .elementsFromPoint(clientX, clientY)
    .some((el) => el instanceof HTMLElement && el.closest('[data-plan-trash]'));
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
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (p) => {
      current = p;
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
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
};

// The slot under a screen point, inside the board `boardEl`.
export function dropSlotAt(
  boardEl: HTMLElement,
  clientX: number,
  clientY: number,
  draggedId: string,
): PlanDropSlot | null {
  const hits = document.elementsFromPoint(clientX, clientY);
  const cell = hits.find(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.dataset.planStatus !== undefined && boardEl.contains(el),
  );
  if (!cell) return null;
  const status = cell.dataset.planStatus!;
  const laneKey = cell.dataset.planLane ?? '';
  const cards = [...cell.querySelectorAll<HTMLElement>('[data-plan-card]')].filter(
    (c) => c.dataset.planCard !== draggedId,
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
  onDrop: (itemId: string, slot: PlanDropSlot) => void;
  onDropOutside: (itemId: string, clientX: number, clientY: number) => void;
  // A drop on a board that does not show the item: nothing moves; the reason is announced.
  onRefused: (message: string) => void;
  onDragging: (itemId: string | null) => void;
  // The dragged card (its type and status), so a column whose status its type leaves out can refuse it.
  item?: (itemId: string) => Pick<Item, 'type' | 'fields'> | undefined;
  // A card let go over the Trash.
  onTrash?: (itemId: string) => void;
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
    dragRef.current = null;
    setDrag(null);
    optsRef.current.onDragging(null);
  }, [leaveTarget, pointer]);

  useEffect(() => {
    const step = (e: PointerEvent) => {
      const p = pressedRef.current;
      const board = boardRef.current;
      if (!p || e.pointerId !== p.pointerId || !board) return;
      // A press that has not travelled the shared slop is still a click.
      if (!dragRef.current && !isDragTravel(e.clientX - p.startX, e.clientY - p.startY)) return;
      if (!dragRef.current) optsRef.current.onDragging(p.itemId);
      const b = board.getBoundingClientRect();
      const outside =
        e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom;
      const other = outside
        ? otherPlanBoardAt(e.clientX, e.clientY, optsRef.current.boardId)
        : null;
      const accepts = !!other && !!planBoardTarget(other.id)?.accepts(p.itemId);
      const otherSlot =
        other && accepts ? dropSlotAt(other.el, e.clientX, e.clientY, p.itemId) : null;
      if (dragRef.current?.target && dragRef.current.target.boardId !== other?.id) leaveTarget();
      // The slot under the pointer, and whether the card's type refuses its status.
      const rawSlot = outside ? otherSlot : dropSlotAt(board, e.clientX, e.clientY, p.itemId);
      const dragged = optsRef.current.item?.(p.itemId);
      const slotTarget = planBoardTarget(other ? other.id : optsRef.current.boardId);
      const refused =
        dragged && rawSlot && slotTarget ? slotTarget.refuseAt(dragged, rawSlot) : null;
      const slot = rawSlot && refused ? { ...rawSlot, beforeId: null } : rawSlot;
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
        ...(outside && trashAt(e.clientX, e.clientY) ? { overTrash: true } : {}),
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
      else if (d.overTrash && optsRef.current.onTrash) optsRef.current.onTrash(d.itemId);
      else if (d.refused) optsRef.current.onRefused(d.refused);
      else if (d.target && target) {
        if (!d.target.accepts) optsRef.current.onRefused(target.refusal());
        else if (d.slot) target.drop(d.itemId, d.slot);
      } else if (d.outside) optsRef.current.onDropOutside(d.itemId, e.clientX, e.clientY);
      else if (d.slot) optsRef.current.onDrop(d.itemId, d.slot);
      end();
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
    (itemId: string, e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      e.stopPropagation();
      pressedRef.current = {
        itemId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        rect: e.currentTarget.getBoundingClientRect(),
      };
    },
    [enabled],
  );

  // `cancelPress` drops a press before it becomes a drag or a click (a long-press opened the card's menu).
  return { drag, pointer, onCardPointerDown, cancelPress: end };
}
