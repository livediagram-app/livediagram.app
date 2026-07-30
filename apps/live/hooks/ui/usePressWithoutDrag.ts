// Press handling for the INTERACTIVE element faces (spec/103's Selection Mode
// button, spec/104's Portal): fire on a click, stay silent on a drag.
//
// Both are real elements as well as controls, so the same gesture has to do two
// jobs — a tap presses them, a drag moves them. The browser doesn't help: a
// drag that starts and ends on the same element still fires `click`, because
// the element travels under the pointer. So we remember where the press began
// and swallow the click if the pointer travelled further than a wobble.
//
// Deliberately NOT a pointerdown-swallow: capturing the press would stop the
// element being dragged at all, which is the thing we're protecting.
//
// `requireDouble` makes it a double-press instead — used by the Reveal zone
// (spec/106), where a stray single click would undo the element's entire
// purpose. Detected from two clicks in a window rather than the DOM's own
// `dblclick`, because that event is unreliable on touch (it competes with
// double-tap-to-zoom) and this way a tap and a click behave identically.

import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent } from 'react';

// Screen px of pointer travel still counted as a tap. Roughly a shaky hand or a
// trackpad micro-slip; anything beyond it was a deliberate move.
const DRAG_SLOP_PX = 5;

// Milliseconds between two presses that still count as one double-press. The
// platform default sits around 500ms; a touch below that keeps a deliberate
// double-tap comfortable without pairing two unrelated clicks.
export const DOUBLE_PRESS_MS = 450;

// Pure so the window itself is testable: was this press the second half of a
// double? `last` is the previous press time, or null when there wasn't one.
export function isDoublePress(last: number | null, now: number): boolean {
  return last !== null && now - last <= DOUBLE_PRESS_MS && now >= last;
}

export function usePressWithoutDrag(
  onPress?: () => void,
  { requireDouble = false }: { requireDouble?: boolean } = {},
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastPressRef = useRef<number | null>(null);
  return {
    // A double-press would otherwise ALSO reach the canvas as a dblclick and
    // open the label editor over the thing we just revealed.
    onDoubleClick: (e: MouseEvent) => {
      if (requireDouble) e.stopPropagation();
    },
    onPointerDown: (e: ReactPointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
    },
    onClick: (e: MouseEvent) => {
      // Never let the click reach the canvas underneath (it would walk an
      // avatar here, or clear the selection).
      e.stopPropagation();
      const start = startRef.current;
      startRef.current = null;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_SLOP_PX) return;
      if (requireDouble) {
        const now = e.timeStamp || performance.now();
        if (!isDoublePress(lastPressRef.current, now)) {
          lastPressRef.current = now;
          return;
        }
        lastPressRef.current = null;
      }
      onPress?.();
    },
  };
}
