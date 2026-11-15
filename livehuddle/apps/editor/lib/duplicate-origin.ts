// What the latest Duplicate copied from (docs/specs/008-canvas/canvas-and-palette.md "Selection popover", blueprint
// duplicate-placement.md "The toolbar keeps clear of the original"; Work Tracker 849): while the copies stay selected,
// the selection toolbar keeps off the originals rather than covering them. One slot, the latest duplicate; it is read
// only while the selection is exactly those copies.

import { useMemo, useSyncExternalStore } from 'react';
import { elementBounds, unionRects, type Element, type Rect } from '@livehuddle/document';

type Origin = { sourceIds: readonly string[]; copyIds: readonly string[] };

let latest: Origin | null = null;
const listeners = new Set<() => void>();

/** A Duplicate copied `sourceIds` as `copyIds` (in any order) and selected the copies. */
export function noteDuplicate(sourceIds: readonly string[], copyIds: readonly string[]): void {
  latest = { sourceIds, copyIds };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => latest;

/** Whether `selected` is exactly the copies `origin` noted. */
function isTheCopies(origin: Origin, selected: readonly string[]): boolean {
  if (selected.length !== origin.copyIds.length) return false;
  const copies = new Set(origin.copyIds);
  return selected.every((id) => copies.has(id));
}

/**
 * The originals' bounds in canvas units while `selected` is exactly the latest duplicate's copies, for the toolbar
 * to keep off; null for any other selection, or when the originals are gone.
 */
export function duplicateOriginBounds(
  origin: Origin | null,
  selected: readonly string[],
  elements: readonly Element[],
): Rect | null {
  if (!origin || selected.length === 0 || !isTheCopies(origin, selected)) return null;
  const sources = new Set(origin.sourceIds);
  const all = elements as Element[];
  return unionRects(all.filter((el) => sources.has(el.id)).map((el) => elementBounds(el, all)));
}

/** `duplicateOriginBounds` for the selection, kept up with the latest duplicate. */
export function useDuplicateOrigin(
  selected: readonly string[],
  elements: readonly Element[],
): Rect | null {
  const origin = useSyncExternalStore(subscribe, read, read);
  // A scan of the tab only while the selection is the copies; memoised so a render that changes neither is free.
  return useMemo(
    () => duplicateOriginBounds(origin, selected, elements),
    [origin, selected, elements],
  );
}
