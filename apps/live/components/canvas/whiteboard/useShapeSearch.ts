'use client';

// The Shapes flyout's state (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows",
// "Shape slots"): the query, what it shows (the six slots in two rows, Recent over Most used, or at
// most six results) and the entry the arrow keys have reached. Focus stays in the field; the active
// entry is announced through aria-activedescendant (the combobox pattern).

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  gridStep,
  searchWhiteboardShapes,
  type GridDirection,
} from '@/lib/whiteboard-shape-search';
import {
  whiteboardShapeEntry,
  type WhiteboardShapeEntry,
  type WhiteboardShapeKey,
} from '@/lib/whiteboard-shape-catalogue';
import type { ShapeSlots } from '@/lib/whiteboard-shape-slots';

// Entries per row: three, so the six slots are two rows and six results two rows too.
export const SHAPE_GRID_COLUMNS = 3;

const DIRECTIONS: Record<string, GridDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export type ShapeGridGroup = { id: string; label: string; entries: WhiteboardShapeEntry[] };

const entriesOf = (keys: readonly WhiteboardShapeKey[]) =>
  keys.map(whiteboardShapeEntry).filter((e): e is WhiteboardShapeEntry => e !== undefined);

export function useShapeSearch(
  slots: ShapeSlots,
  onPick: (key: WhiteboardShapeKey, searched: boolean) => void,
  // Pinned shapes a phone's bar has no room for, as a row above the slots.
  menuPins: readonly WhiteboardShapeKey[] = [],
) {
  const [query, setQueryState] = useState('');
  const [active, setActive] = useState(0);
  const searching = query.trim().length > 0;
  const groups: ShapeGridGroup[] = useMemo(
    () =>
      searching
        ? [{ id: 'results', label: 'Matching shapes', entries: searchWhiteboardShapes(query) }]
        : // Recent on top, Most used below (a kind in both shows only below: Most used is steadier),
          // under a phone's pins that the bar has no room for.
          [
            ...(menuPins.length > 0
              ? [{ id: 'pinned', label: 'Pinned shapes', entries: entriesOf(menuPins) }]
              : []),
            { id: 'recent', label: 'Recent shapes', entries: entriesOf(slots.recent) },
            { id: 'most-used', label: 'Most used shapes', entries: entriesOf(slots.mostUsed) },
          ],
    [searching, query, slots, menuPins],
  );
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

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
      const sizes = groups.map((g) => g.entries.length);
      setActive((i) => gridStep(sizes, SHAPE_GRID_COLUMNS, i, dir));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = flat[active];
      if (entry) onPick(entry.key, searching);
    }
  };

  return {
    query,
    setQuery,
    searching,
    groups,
    flat,
    active: Math.min(active, Math.max(0, flat.length - 1)),
    setActive,
    onKeyDown,
  };
}
