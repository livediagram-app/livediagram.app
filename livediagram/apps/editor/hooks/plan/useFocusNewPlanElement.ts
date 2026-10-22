'use client';

// A board, visualisation or Sheet this person just added (placed from the palette, dropped, drawn to size) is glided
// into view, as its header's Focus does (docs/specs/026-plan/plan-board.md "Focus"). Their own add is the one it
// selects; a peer's add, an undo, a tab switch or the first load are not focused.
import { useEffect, useRef } from 'react';
import { isBoxed, type Element } from '@livediagram/document';

const FOCUSED_KINDS: ReadonlySet<string> = new Set(['plan-board', 'plan-view', 'plan-sheet']);

// An element a new add glides to fit (so the phone's scroll-into-view of a new element leaves it to the glide).
export const isFocusedOnAdd = (el: Element): boolean =>
  el.type === 'shape' && FOCUSED_KINDS.has(el.shape);

export function useFocusNewPlanElement(opts: {
  tabId: string;
  elements: readonly Element[];
  selectedId: () => string | null;
  focus: (bounds: { x: number; y: number; w: number; h: number }) => void;
}) {
  const { tabId, elements, selectedId, focus } = opts;
  const known = useRef<{ tabId: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const ids = new Set(elements.map((el) => el.id));
    const prev = known.current;
    known.current = { tabId, ids };
    if (!prev || prev.tabId !== tabId) return;
    const sel = selectedId();
    const added = elements.find(
      (el) => !prev.ids.has(el.id) && el.id === sel && isBoxed(el) && isFocusedOnAdd(el),
    );
    if (added && isBoxed(added)) focus({ x: added.x, y: added.y, w: added.width, h: added.height });
  }, [tabId, elements, selectedId, focus]);
}
