'use client';

// A finger on a Sheet's grid (docs/specs/029-sheets/sheet.md "On a touch screen"; blueprint sheet-element.md
// "Pointer"). A finger pans the cells (useSheetPan; maximised, the grid scrolls natively) and a tap selects. A finger
// held still for LONG_PRESS_MS grabs the cell or header under it: dragging on from there selects a range (or several
// rows or columns), and letting go unmoved opens its menu. The selection's grip, a round handle at its bottom right,
// drags its corner once the finger moves; a tap on or near it is a tap. While a finger selects, the page never
// scrolls under it.
import { useRef } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { useLongPress } from '@/hooks/ui/useLongPress';
import type { Hit } from './sheet-geometry';
import type { SheetPan } from './useSheetPan';

// How far round the drawn grip a finger takes it: a finger's 44px target (touch-targets.md).
export const TOUCH_GRIP_HIT_PX = 22;
// A held press that moves this far (screen px) is a drag selecting from the held cell.
const HOLD_DRAG_PX = 6;
// The click that follows a finger's selection (its own release) is not a tap.
const AFTER_SELECT_MS = 400;

type Cells = Extract<Hit, { kind: 'cell' | 'col' | 'row' }>;

type SheetTouchDeps = {
  interactive: boolean;
  maximised: boolean;
  pan: SheetPan;
  local: (clientX: number, clientY: number) => { x: number; y: number };
  hitAt: (x: number, y: number) => Hit;
  // A point in the viewport is on the selection's grip (within TOUCH_GRIP_HIT_PX).
  onGrip: (x: number, y: number) => boolean;
  // A held press: what is under it shows as selected (unless it is already in the selection).
  grab: (h: Cells) => void;
  // A select drag from the held hit (or the grip) begins at this point and follows the finger.
  extend: (from: Cells | 'grip', clientX: number, clientY: number) => void;
  openMenu: (clientX: number, clientY: number) => void;
};

export function useSheetTouch(deps: SheetTouchDeps) {
  const latest = useLatest(deps);
  // When the last finger selection ended (performance.now()), for the click it leaves behind.
  const ended = useRef(-Infinity);

  // From a hold (or a grip press) until the finger lifts: no page scroll, and the end is stamped (unless `tapUnmoved`:
  // a grip press let go unmoved leaves its click to select as a tap).
  const own = (
    onEnd?: (moved: boolean) => void,
    moving?: (ev: PointerEvent) => boolean,
    tapUnmoved = false,
  ) => {
    const stop = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && moving?.(ev)) moved = true;
    };
    const done = () => {
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
      if (moved || !tapUnmoved) ended.current = performance.now();
      onEnd?.(moved);
    };
    window.addEventListener('touchmove', stop, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  };

  const hold = useLongPress((x0, y0) => {
    const d = latest.current;
    const { x, y } = d.local(x0, y0);
    const h = d.hitAt(x, y);
    if (h.kind !== 'cell' && h.kind !== 'col' && h.kind !== 'row') return;
    // The finger now selects: whatever pan it began lets go.
    d.pan.release();
    d.grab(h);
    own(
      (moved) => {
        if (!moved) latest.current.openMenu(x0, y0);
      },
      (ev) => {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < HOLD_DRAG_PX) return false;
        latest.current.extend(h, x0, y0);
        return true;
      },
    );
  });

  const onTouchDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = latest.current;
    // A second finger: the pinch (the canvas's, or the browser's when maximised), never a hold.
    if (e.isPrimary === false) {
      hold.cancel();
      if (!d.pan.begin(e, { maximised: d.maximised })) e.stopPropagation();
      return;
    }
    const { x, y } = d.local(e.clientX, e.clientY);
    if (d.onGrip(x, y)) {
      e.preventDefault();
      e.stopPropagation();
      const [x0, y0] = [e.clientX, e.clientY];
      own(
        undefined,
        (ev) => {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < HOLD_DRAG_PX) return false;
          latest.current.extend('grip', ev.clientX, ev.clientY);
          return true;
        },
        true,
      );
      return;
    }
    if (!d.pan.begin(e, { maximised: d.maximised })) e.stopPropagation();
    const h = d.hitAt(x, y);
    if (h.kind === 'cell' || h.kind === 'col' || h.kind === 'row') hold.onPointerDown(e);
  };

  // The click a finger's selection leaves behind on release is swallowed, as a pan's is.
  const swallowTap = () => performance.now() - ended.current < AFTER_SELECT_MS;

  return { onTouchDown, swallowTap, ring: hold.pressPoint };
}
