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

import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent } from 'react';

// Screen px of pointer travel still counted as a tap. Roughly a shaky hand or a
// trackpad micro-slip; anything beyond it was a deliberate move.
const DRAG_SLOP_PX = 5;

export function usePressWithoutDrag(onPress?: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  return {
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
      onPress?.();
    },
  };
}
