'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  CORNER_CARD_EVENT,
  cornerCardClear,
} from '@liveworkspace/workbench/components/canvas/menu-join';

// How far a top-docked Draw dock's right edge stops from the canvas's right edge (docs/specs/023-draw-mode/draw-mode.md
// "Where the dock sits"): clear of the corner card at the top right (Share and the account, EditorCornerActions), in
// the dock's own CSS pixels (a screen length divided by the toolbar UI scale). Null where no card stands over this
// editor, or until measured, when the dock's 12 px margin holds.
export function useCornerCardClearance(
  dock: RefObject<HTMLElement | null>,
  scale: number,
  active: boolean,
): number | null {
  const [clearance, setClearance] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const own = dock.current;
    const container = own?.offsetParent ?? own?.parentElement;
    if (!own || !container) return;
    const measure = () => {
      const view = container.getBoundingClientRect();
      const px = cornerCardClear(view.width, view.left);
      const next = px > 0 ? Math.round(px / (scale > 0 ? scale : 1)) : null;
      setClearance((prev) => (prev === next ? prev : next));
    };
    measure();
    // The card says when it mounts, resizes (dropping its names) or goes; the window moves it.
    window.addEventListener(CORNER_CARD_EVENT, measure);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener(CORNER_CARD_EVENT, measure);
      window.removeEventListener('resize', measure);
    };
  }, [dock, scale, active]);
  return active ? clearance : null;
}
