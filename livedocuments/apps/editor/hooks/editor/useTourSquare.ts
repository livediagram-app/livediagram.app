'use client';

import { useCallback, useRef } from 'react';
import type { Element, Tab } from '@livedocuments/document';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// A tour's demonstration elements (docs/specs/007-editor/pages-tour.md): elements a tour places on the active tab to
// show a step on. Taken away when the tour ends, however it ends, so the document is
// left as it was. Placed and removed with no history (tickTabs), so Undo never brings them back.
export function useTourSquare(opts: {
  activeId: string;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
}) {
  const liveRef = useLatest(opts);
  const placedRef = useRef<string[]>([]);

  const place = useCallback(
    (...els: Element[]) => {
      const { activeId, tickTabs } = liveRef.current;
      tickTabs((tabs) =>
        tabs.map((t) => (t.id === activeId ? { ...t, elements: [...t.elements, ...els] } : t)),
      );
      placedRef.current = [...placedRef.current, ...els.map((el) => el.id)];
    },
    [liveRef],
  );

  // Off whichever tab holds them; a no-op when the tour placed nothing (it reused an element already there).
  // The ids it took away, so the caller can drop the selection the tour gave them.
  const remove = useCallback((): string[] => {
    const ids = placedRef.current;
    if (ids.length === 0) return [];
    placedRef.current = [];
    const gone = new Set(ids);
    liveRef.current.tickTabs((tabs) =>
      tabs.map((t) =>
        t.elements.some((el) => gone.has(el.id))
          ? { ...t, elements: t.elements.filter((el) => !gone.has(el.id)) }
          : t,
      ),
    );
    return ids;
  }, [liveRef]);

  return { place, remove };
}
