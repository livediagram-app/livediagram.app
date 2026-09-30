'use client';

// The More shapes search's state (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// the query, its results, and the result the arrow keys have reached. Focus stays in the field;
// the active result is announced through aria-activedescendant (the combobox pattern).

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  gridStep,
  searchWhiteboardShapes,
  type GridDirection,
} from '@/lib/whiteboard-shape-search';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';

// Results per row: six 40 px cells fill the flyout's fixed width.
export const SHAPE_SEARCH_COLUMNS = 6;

const DIRECTIONS: Record<string, GridDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function useShapeSearch(onPick: (key: WhiteboardShapeKey) => void) {
  const [query, setQueryState] = useState('');
  const [active, setActive] = useState(0);
  const view = useMemo(() => searchWhiteboardShapes(query), [query]);
  const flat = useMemo(() => view.groups.flatMap((g) => g.entries), [view]);
  const sizes = useMemo(() => view.groups.map((g) => g.entries.length), [view]);

  // A new query starts at its best match.
  const setQuery = (next: string) => {
    setQueryState(next);
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const dir = DIRECTIONS[e.key];
    // Every arrow walks the grid (the spec's rule); Home and End still move the caret.
    if (dir) {
      e.preventDefault();
      setActive((i) => gridStep(sizes, SHAPE_SEARCH_COLUMNS, i, dir));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = flat[active];
      if (entry) onPick(entry.key);
    }
  };

  return {
    query,
    setQuery,
    view,
    flat,
    active: Math.min(active, Math.max(0, flat.length - 1)),
    setActive,
    onKeyDown,
  };
}
