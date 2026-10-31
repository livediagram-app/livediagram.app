// Where the Find bar's matches are drawn (docs/specs/007-editor/find-and-replace.md "Highlights"; blueprint
// "Highlights"): the stretches of each article's writing and the elements holding a match, each marked as a match,
// the current one or a held one. Published by useFindReplace, read by the writing's find plugin and the canvas's ring
// overlay, so neither the canvas nor the editor state re-renders as the matches change. Never stored or synced.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type FindMark = 'match' | 'current' | 'held';

export type FindBlockMark = { blockId: string; from: number; to: number; mark: FindMark };

export type FindHighlights = {
  // Each article's marked stretches, by flow.
  flows: ReadonlyMap<string, readonly FindBlockMark[]>;
  // The elements holding a match, by id: the strongest mark among their matches.
  elements: ReadonlyMap<string, FindMark>;
};

const EMPTY: FindHighlights = { flows: new Map(), elements: new Map() };
let current: FindHighlights = EMPTY;
const listeners = createListeners();

export function publishFindHighlights(next: FindHighlights): void {
  current = next;
  listeners.notify();
}

export function clearFindHighlights(): void {
  if (current === EMPTY) return;
  publishFindHighlights(EMPTY);
}

export function getFindHighlights(): FindHighlights {
  return current;
}

export function subscribeFindHighlights(listener: () => void): () => void {
  return listeners.subscribe(listener);
}

/** The marked elements, for the ring overlay. */
export function useFindElementMarks(): ReadonlyMap<string, FindMark> {
  return useSyncExternalStore(
    subscribeFindHighlights,
    () => current.elements,
    () => EMPTY.elements,
  );
}
