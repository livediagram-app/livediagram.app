'use client';

// A header chip's card on the move (docs/specs/026-plan/plan-board.md "Card type chips"): idle, pressed, carrying,
// then dropped or cancelled. A press that never travels the shared slop is the chip's click. Carried, a ghost card
// follows the pointer (moved by style each frame, never by a React render), and the board under it, any board on
// screen that shows the type, opens the placeholder a dragged card opens (plan-board-targets.ts): the cell is read
// from the board's own DOM, as a card's drop is (dropSlotAt), and a column whose status the type leaves out is
// refused there, red with the reason. Let go over an open slot, the board adds the card there (`addCard`).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isDragTravel } from '@liveworkspace/workbench/lib/press-gestures';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { CHIP_DRAG_ID, CHIP_GHOST_HEIGHT_PX } from '@/components/plan/card-type-chips';
import {
  otherPlanBoardAt,
  planBoardTarget,
  sameIncoming,
  type PlanIncoming,
} from './plan-board-targets';
import { dropSlotAt, type PlanDropSlot } from './usePlanCardDrag';

type Pressed = { type: string; pointerId: number; startX: number; startY: number };

// What the pointer is over while carrying: a board and the slot it would open, or why it is refused.
type Over = {
  boardId: string;
  slot: PlanDropSlot | null;
  // The slot's column refuses the type (its status is left out), or the board shows no cards of it.
  refused: string | null;
};

// Where the ghost's top left sits from the pointer: just below and right of it, so the cell under the pointer stays
// in view.
export const CHIP_GHOST_OFFSET = { x: 12, y: 12 };

export function useCardTypeDrag(opts: {
  // A press that never travelled: the chip's click.
  onClick: (type: string) => void;
  // A drop over a refused cell or a board that does not take the type: the reason, for the screen reader and toast.
  onRefused: (message: string) => void;
  // The ghost card, drawn by the caller while `carrying`; the hook moves it.
  ghostRef: React.RefObject<HTMLElement | null>;
}) {
  const latest = useLatest(opts);
  const pressed = useRef<Pressed | null>(null);
  const over = useRef<Over | null>(null);
  const lastHover = useRef<PlanIncoming | null>(null);
  const frame = useRef<number | null>(null);
  const latestMove = useRef<PointerEvent | null>(null);
  // The type being carried (past the slop), for the ghost and the chip's cursor.
  const [carrying, setCarrying] = useState<string | null>(null);
  const carryingRef = useRef(false);
  // The pointer's last place, so the ghost starts under it the frame it mounts.
  const point = useRef({ x: 0, y: 0 });

  const { ghostRef } = opts;
  const placeGhost = useCallback(() => {
    ghostRef.current?.style.setProperty(
      'transform',
      `translate(${point.current.x + CHIP_GHOST_OFFSET.x}px, ${point.current.y + CHIP_GHOST_OFFSET.y}px)`,
    );
  }, [ghostRef]);
  useLayoutEffect(() => {
    if (carrying) placeGhost();
  }, [carrying, placeGhost]);

  const hoverBoard = useCallback((boardId: string, next: PlanIncoming | null) => {
    if (sameIncoming(lastHover.current, next)) return;
    lastHover.current = next;
    planBoardTarget(boardId)?.hover(next);
  }, []);

  // Tells the board last hovered that the card has gone.
  const leave = useCallback(() => {
    const id = over.current?.boardId;
    if (id) hoverBoard(id, null);
    over.current = null;
    lastHover.current = null;
  }, [hoverBoard]);

  const end = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    latestMove.current = null;
    leave();
    pressed.current = null;
    carryingRef.current = false;
    setCarrying(null);
  }, [leave]);

  useEffect(() => {
    const step = (e: PointerEvent) => {
      const p = pressed.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!carryingRef.current) {
        if (!isDragTravel(e.clientX - p.startX, e.clientY - p.startY)) return;
        carryingRef.current = true;
        setCarrying(p.type);
      }
      point.current = { x: e.clientX, y: e.clientY };
      placeGhost();
      const board = otherPlanBoardAt(e.clientX, e.clientY, '');
      if (over.current && over.current.boardId !== board?.id) leave();
      const target = board ? planBoardTarget(board.id) : undefined;
      if (!board || !target) return;
      if (!target.acceptsType(p.type)) {
        over.current = { boardId: board.id, slot: null, refused: target.refusal() };
        hoverBoard(board.id, null);
        return;
      }
      const raw = dropSlotAt(board.el, e.clientX, e.clientY, CHIP_DRAG_ID);
      const refused = raw ? target.refuseAt({ type: p.type, fields: {} }, raw) : null;
      // A refused column shows its placeholder at its foot, as a refused card's does.
      const slot = raw && refused ? { ...raw, beforeId: null } : raw;
      over.current = { boardId: board.id, slot, refused };
      hoverBoard(
        board.id,
        slot
          ? {
              itemId: CHIP_DRAG_ID,
              slot,
              height: CHIP_GHOST_HEIGHT_PX,
              ...(refused ? { refused } : {}),
            }
          : null,
      );
    };
    const onMove = (e: PointerEvent) => {
      const p = pressed.current;
      if (!p || e.pointerId !== p.pointerId) return;
      latestMove.current = e;
      // One hit test per animation frame, on the latest move.
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const move = latestMove.current;
        latestMove.current = null;
        if (move) step(move);
      });
    };
    const onUp = (e: PointerEvent) => {
      const p = pressed.current;
      if (!p || e.pointerId !== p.pointerId) return;
      // The last move not yet stepped is stepped now, so the card lands where the pointer let go.
      if (latestMove.current) step(latestMove.current);
      const at = over.current;
      if (!carryingRef.current) latest.current.onClick(p.type);
      else if (at?.refused) latest.current.onRefused(at.refused);
      else if (at?.slot) planBoardTarget(at.boardId)?.addCard(p.type, at.slot);
      end();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pressed.current) {
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
  }, [end, hoverBoard, latest, leave, placeGhost]);
  // Unmounted mid-carry (the board left): no placeholder is left open.
  useEffect(
    () => () => {
      if (pressed.current) end();
    },
    [end],
  );

  // A press on a chip: kept from the header (which would pick the board up) and the canvas.
  const onPointerDown = useCallback((type: string, e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    pressed.current = { type, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
  }, []);

  return { carrying, onPointerDown };
}
