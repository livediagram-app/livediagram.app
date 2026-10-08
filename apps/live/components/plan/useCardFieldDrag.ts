'use client';

// The Display tab's drag of a field (docs/specs/026-plan/item-types.md "Editing a type": Display), by mouse, pen or
// touch: a chip on the card, or a field from Available Fields. It reports where the field would land (the part of
// the card under the pointer and the place among that part's chips), whether the pointer is over Available Fields
// (where a placed field comes off), and moves a floating copy with the pointer by writing its transform directly, so
// the editor re-renders only when the landing place changes. Escape cancels a drag.
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { cardSlotFits, type CardField, type CardSize, type CardSlot } from '@livediagram/items';

// How far a press travels before it is a drag (a shorter press is a click).
export const DRAG_START_PX = 4;

export type FieldDrag = { field: CardField; startX: number; startY: number; moving: boolean };
export type FieldDropTarget = { slot: CardSlot; index: number };

const sameTarget = (a: FieldDropTarget | null, b: FieldDropTarget | null) =>
  a === b || (!!a && !!b && a.slot === b.slot && a.index === b.index);

// Where `field` would land at (x, y): the card part under the pointer that takes it, and its place among the part's
// other chips (those whose centre is before the pointer, reading left to right, top to bottom).
export function dropTargetAt(
  card: HTMLElement | null,
  size: CardSize,
  field: CardField,
  x: number,
  y: number,
): FieldDropTarget | null {
  const zone = (document.elementsFromPoint?.(x, y) ?? [])
    .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-slot]'))
    .find((el) => !!el && !!card?.contains(el));
  const slot = zone?.dataset.slot as CardSlot | undefined;
  if (!zone || !slot || !cardSlotFits(size, slot, field)) return null;
  let index = 0;
  for (const chip of zone.querySelectorAll<HTMLElement>('[data-chip]')) {
    if (chip.dataset.chip === field) continue;
    const r = chip.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    if (cy < y - r.height / 2 || (Math.abs(cy - y) <= r.height / 2 && r.left + r.width / 2 < x))
      index += 1;
  }
  return { slot, index };
}

export function useCardFieldDrag({
  size,
  card,
  tray,
  onDrop,
  onTakeOff,
}: {
  size: CardSize;
  card: RefObject<HTMLElement | null>;
  // Available Fields: a placed field dropped there comes off the card.
  tray: RefObject<HTMLElement | null>;
  onDrop: (field: CardField, target: FieldDropTarget) => void;
  onTakeOff: (field: CardField) => void;
}) {
  const [drag, setDrag] = useState<FieldDrag | null>(null);
  const [target, setTarget] = useState<FieldDropTarget | null>(null);
  const [overTray, setOverTray] = useState(false);
  // The floating copy, moved without a render; `pointer` places it on the render that first draws it.
  const ghost = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const endDrag = () => {
    setDrag(null);
    setTarget(null);
    setOverTray(false);
  };

  const place = (x: number, y: number) => {
    pointer.current = { x, y };
    if (ghost.current) ghost.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  // The drag as the window's listeners read it (state is what the editor draws).
  const live = useRef<{
    drag: FieldDrag;
    target: FieldDropTarget | null;
    overTray: boolean;
    pointerId: number;
    onClick?: ((el: HTMLElement) => void) | undefined;
    el: HTMLElement;
  } | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const finish = () => {
    stop.current?.();
    stop.current = null;
    live.current = null;
    endDrag();
  };
  // Escape's cancel ends the window listeners too.
  const cancelRef = useLatest(finish);

  // Escape cancels a drag under way, before the dialog hears it (it would close).
  const moving = !!drag?.moving;
  useEffect(() => {
    if (!moving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cancelRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [moving, cancelRef]);

  // Pointer handling for anything that drags a field; `onClick` runs for a press that never moved. Once pressed,
  // the drag follows that pointer on the window, not on the chip: a pointer's capture can be lost as the editor
  // re-renders (a touch's, and a mouse's in some browsers), and the release then lands on whatever part of the
  // card is under it, which would leave the drag stuck. The window always hears it.
  const dragProps = (field: CardField, onClick?: (el: HTMLElement) => void) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      stop.current?.();
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      live.current = {
        drag: { field, startX, startY, moving: false },
        target: null,
        overTray: false,
        pointerId,
        onClick,
        el: e.currentTarget,
      };
      place(startX, startY);
      setDrag(live.current.drag);
      const onMove = (ev: globalThis.PointerEvent) => {
        const l = live.current;
        if (!l || ev.pointerId !== pointerId) return;
        place(ev.clientX, ev.clientY);
        if (!l.drag.moving) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= DRAG_START_PX) return;
          l.drag = { ...l.drag, moving: true };
          setDrag(l.drag);
        }
        const next = dropTargetAt(card.current, size, field, ev.clientX, ev.clientY);
        if (!sameTarget(l.target, next)) {
          l.target = next;
          setTarget(next);
        }
        const inTray =
          !next &&
          (document.elementsFromPoint?.(ev.clientX, ev.clientY) ?? []).some(
            (el) => !!tray.current?.contains(el),
          );
        if (inTray !== l.overTray) {
          l.overTray = inTray;
          setOverTray(inTray);
        }
      };
      const onUp = (ev: globalThis.PointerEvent) => {
        const l = live.current;
        if (!l || ev.pointerId !== pointerId) return;
        if (l.drag.moving) {
          if (l.target) onDrop(field, l.target);
          else if (l.overTray) onTakeOff(field);
        } else l.onClick?.(l.el);
        finish();
      };
      const onCancel = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId === pointerId) finish();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      stop.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
    },
  });

  // A drag in flight when the editor goes away takes its listeners with it.
  useEffect(() => () => stop.current?.(), []);

  return { drag, target, overTray, dragProps, ghost, pointer };
}
