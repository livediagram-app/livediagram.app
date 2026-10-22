import { useEffect } from 'react';
import { endPlanCardDrag, planCardHoverAt } from './plan-card-drop';

// A pressed card tile (docs/specs/026-plan/plan-mode.md "The palette"): while a card of `type` is in hand,
// the column under the pointer opens the gap where a press would put it, as a dragged card does. Null
// when no card is in hand; the gap closes the moment it is placed or let go.
export function usePlanCardPlacingGap(type: string | null): void {
  useEffect(() => {
    if (!type) return;
    const onMove = (e: PointerEvent) => planCardHoverAt(type, e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      endPlanCardDrag();
    };
  }, [type]);
}
