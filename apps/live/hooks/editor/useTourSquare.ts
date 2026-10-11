'use client';

import { useCallback, useRef } from 'react';
import type { Element, Tab } from '@livediagram/document';
import { useLatest } from '@/hooks/ui/useLatest';

// The welcome tour's demonstration square (docs/specs/007-editor/editor-tour.md "The steps", Element context
// menu): on an empty tab the tour places one to open the element menu on, and takes it away when the tour
// ends, however it ends, so a fresh document is left as it was. Placed and removed with no history (tickTabs),
// like the Plan tour's example board, so Undo never brings it back.
export function useTourSquare(opts: {
  activeId: string;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
}) {
  const liveRef = useLatest(opts);
  const placedRef = useRef<string | null>(null);

  const place = useCallback(
    (square: Element) => {
      const { activeId, tickTabs } = liveRef.current;
      tickTabs((tabs) =>
        tabs.map((t) => (t.id === activeId ? { ...t, elements: [...t.elements, square] } : t)),
      );
      placedRef.current = square.id;
    },
    [liveRef],
  );

  // Off whichever tab holds it; a no-op when the tour placed nothing (it reused an element already there).
  // The id it took away, so the caller can drop the selection the tour gave it.
  const remove = useCallback((): string | null => {
    const id = placedRef.current;
    if (!id) return null;
    placedRef.current = null;
    liveRef.current.tickTabs((tabs) =>
      tabs.map((t) =>
        t.elements.some((el) => el.id === id)
          ? { ...t, elements: t.elements.filter((el) => el.id !== id) }
          : t,
      ),
    );
    return id;
  }, [liveRef]);

  return { place, remove };
}
