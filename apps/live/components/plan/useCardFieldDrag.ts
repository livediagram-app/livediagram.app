'use client';

// The Display tab's drag of a field (docs/specs/026-plan/item-types.md "Editing a type": Display), by mouse, pen or
// touch: a chip on the card, or a field from Available Fields. It reports where the field would land (the part of
// the card under the pointer and the place among that part's chips), whether the pointer is over Available Fields
// (where a placed field comes off), and moves a floating copy with the pointer by writing its transform directly, so
// the editor re-renders only when the landing place changes. Escape cancels a drag.
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
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

  // Escape cancels a drag under way, before the dialog hears it (it would close).
  const moving = !!drag?.moving;
  useEffect(() => {
    if (!moving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      endDrag();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [moving]);

  const place = (x: number, y: number) => {
    pointer.current = { x, y };
    if (ghost.current) ghost.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  // Pointer handlers for anything that drags a field; `onClick` runs for a press that never moved.
  const dragProps = (field: CardField, onClick?: (el: HTMLElement) => void) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Not capturable: the drag still follows while over the chip.
      }
      place(e.clientX, e.clientY);
      setDrag({ field, startX: e.clientX, startY: e.clientY, moving: false });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag || drag.field !== field) return;
      const now =
        drag.moving || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_START_PX;
      place(e.clientX, e.clientY);
      if (!now) return;
      if (!drag.moving) setDrag({ ...drag, moving: true });
      const next = dropTargetAt(card.current, size, field, e.clientX, e.clientY);
      setTarget((t) => (sameTarget(t, next) ? t : next));
      const inTray =
        !next &&
        (document.elementsFromPoint?.(e.clientX, e.clientY) ?? []).some(
          (el) => !!tray.current?.contains(el),
        );
      setOverTray(inTray);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      // A drag cancelled with Escape has already ended: the release does nothing.
      if (!drag || drag.field !== field) return;
      if (drag.moving) {
        if (target) onDrop(field, target);
        else if (overTray) onTakeOff(field);
      } else onClick?.(e.currentTarget);
      endDrag();
    },
    onPointerCancel: endDrag,
  });

  return { drag, target, overTray, dragProps, ghost, pointer };
}
