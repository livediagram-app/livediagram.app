'use client';

// Picking a card up on a Plan board (docs/specs/025-plan/blueprints/plan-board.md "Behaviour and
// state"): idle, pressed, dragging, then dropped or cancelled. A press that never moves is a click
// (open the item). While dragging, a copy follows the pointer and the slot it would land in is
// read from the board's own DOM under the pointer: the column (`data-plan-status`), the row
// (`data-plan-lane`) and the cards there (`data-plan-card`), so the hit test can never disagree
// with what is drawn. A drop on another board moves the item there (its column, and its row when
// that board has rows); a drop on the canvas leaves a Plan card there.
import { useCallback, useEffect, useRef, useState } from 'react';
import { otherPlanBoardAt, planBoardTarget } from './plan-board-targets';

// A press that moves this far (screen px) is a drag, not a click: the canvas's own threshold.
export const PLAN_DRAG_SLOP_PX = 4;

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
  // Over the Trash button (docs/specs/025-plan/items.md "Trash"): letting go trashes the card.
  overTrash?: boolean;
};

// Whether a screen point is over the Trash button.
export function trashAt(clientX: number, clientY: number): boolean {
  return document
    .elementsFromPoint(clientX, clientY)
    .some((el) => el instanceof HTMLElement && el.closest('[data-plan-trash]'));
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

  // Tells the board last hovered that the card has left it.
  const leaveTarget = useCallback(() => {
    const boardId = dragRef.current?.target?.boardId;
    if (boardId) planBoardTarget(boardId)?.hover(null);
  }, []);

  const end = useCallback(() => {
    leaveTarget();
    pressedRef.current = null;
    dragRef.current = null;
    setDrag(null);
    optsRef.current.onDragging(null);
  }, [leaveTarget]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pressedRef.current;
      const board = boardRef.current;
      if (!p || e.pointerId !== p.pointerId || !board) return;
      const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (!dragRef.current && moved < PLAN_DRAG_SLOP_PX) return;
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
      if (other && otherSlot) {
        planBoardTarget(other.id)?.hover({
          itemId: p.itemId,
          slot: otherSlot,
          height: p.rect.height,
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
        slot: outside ? otherSlot : dropSlotAt(board, e.clientX, e.clientY, p.itemId),
        outside,
        target: other ? { boardId: other.id, accepts } : null,
        ...(outside && trashAt(e.clientX, e.clientY) ? { overTrash: true } : {}),
      };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = (e: PointerEvent) => {
      const p = pressedRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const d = dragRef.current;
      const target = d?.target ? planBoardTarget(d.target.boardId) : undefined;
      if (!d) optsRef.current.onClick(p.itemId);
      else if (d.overTrash && optsRef.current.onTrash) optsRef.current.onTrash(d.itemId);
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
  }, [boardRef, end, leaveTarget]);

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

  return { drag, onCardPointerDown };
}
