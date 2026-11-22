'use client';

// A long press on a page tree row opens its menu (docs/specs/030-knowledgebase/blueprints/page-tree.md "Right-click
// and long press"): a touch screen's right-click. A finger held still for LONG_PRESS_MS fires it; moving past the
// slop, lifting, the browser taking the press for a scroll (pointercancel) or a drag starting cancels it, so a drag to
// reorder and a scroll of the list never open a menu. The click a browser sends after the release is the press's own,
// not a tap on the row: `takeClick` swallows it once. The tree calls these from its one set of listeners, so rows
// carry no handlers.
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import type { MenuPoint } from '@liveworkspace/workbench/components/primitives/usePortalMenuPlacement';

/** How long a finger is held still before the menu opens: the platforms' own long press. */
export const LONG_PRESS_MS = 500;
/** How far the finger may drift while held, in px, before the press is a scroll or a drag instead. */
export const LONG_PRESS_SLOP_PX = 8;

type Held = { pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> };

export type RowLongPress = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  // Lifting, the browser's cancel, a drag starting or a right-click: the hold ends without firing.
  cancel: () => void;
  // True once for the click that follows a press that fired; the tree then ignores that click.
  takeClick: () => boolean;
  // The press that is open fired (a drag starting after it closes the menu it opened).
  fired: () => boolean;
};

/** `onLongPress(target, point)` runs when a touch or pen press on `target` is held still long enough. `accepts`
 *  says whether a press on that target may become one (a row, not one of its buttons). */
export function useRowLongPress(
  accepts: (target: EventTarget | null) => boolean,
  onLongPress: (target: Element, point: MenuPoint) => void,
): RowLongPress {
  const held = useRef<Held | null>(null);
  const done = useRef(false);
  const latest = useRef({ accepts, onLongPress });
  useEffect(() => {
    latest.current = { accepts, onLongPress };
  });
  const cancel = useCallback(() => {
    if (held.current) clearTimeout(held.current.timer);
    held.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      cancel();
      done.current = false;
      // A mouse has its right button; a second finger is a pinch.
      if (e.pointerType === 'mouse' || !e.isPrimary || !latest.current.accepts(e.target)) return;
      const target = e.target as Element;
      const point = { x: e.clientX, y: e.clientY };
      held.current = {
        pointerId: e.pointerId,
        ...point,
        timer: setTimeout(() => {
          held.current = null;
          done.current = true;
          latest.current.onLongPress(target, point);
        }, LONG_PRESS_MS),
      };
    },
    [cancel],
  );
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const at = held.current;
      if (!at || at.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - at.x, e.clientY - at.y) > LONG_PRESS_SLOP_PX) cancel();
    },
    [cancel],
  );
  const takeClick = useCallback(() => {
    const was = done.current;
    done.current = false;
    return was;
  }, []);
  const fired = useCallback(() => done.current, []);
  return { onPointerDown, onPointerMove, cancel, takeClick, fired };
}
