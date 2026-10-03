// The editor's selection, held apart from its render state (docs/specs/008-canvas/canvas-performance.md
// "A selection change re-renders what it touches"): one store per editor, read by the views that show
// the selection and by handlers when they run. Setters are shaped as React's setState, so call sites
// keep their form; a set that changes nothing notifies nobody.

import type { SetStateAction } from 'react';
import { debugLog } from './debug-log';

export type Selection = {
  readonly selectedId: string | null;
  readonly multiSelectedIds: ReadonlySet<string>;
};

export const EMPTY_SELECTION: Selection = Object.freeze({
  selectedId: null,
  multiSelectedIds: new Set<string>(),
});

export type SelectionStore = {
  get(): Selection;
  subscribe(listener: () => void): () => void;
  setSelectedId(next: SetStateAction<string | null>): void;
  setMultiSelectedIds(next: SetStateAction<Set<string>>): void;
  setSelection(next: Selection): void;
};

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function createSelectionStore(): SelectionStore {
  let current = EMPTY_SELECTION;
  const listeners = new Set<() => void>();

  const commit = (next: Selection) => {
    if (
      next.selectedId === current.selectedId &&
      sameMembers(next.multiSelectedIds, current.multiSelectedIds)
    ) {
      return;
    }
    current = next;
    debugLog('[selection] change', {
      single: next.selectedId,
      multi: next.multiSelectedIds.size,
    });
    for (const listener of [...listeners]) listener();
  };

  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSelectedId(next) {
      const selectedId = typeof next === 'function' ? next(current.selectedId) : next;
      commit({ selectedId, multiSelectedIds: current.multiSelectedIds });
    },
    setMultiSelectedIds(next) {
      // Updaters receive a Set, as they did from useState; the store never mutates what it holds.
      const multiSelectedIds =
        typeof next === 'function' ? next(current.multiSelectedIds as Set<string>) : next;
      commit({ selectedId: current.selectedId, multiSelectedIds });
    },
    setSelection: commit,
  };
}

export type ElementSelectionFlags = { selected: boolean; multi: boolean; single: boolean };

export function elementSelectionFlags(s: Selection, id: string): ElementSelectionFlags {
  const multi = s.multiSelectedIds.has(id);
  return {
    selected: s.selectedId === id || multi,
    multi,
    single: s.selectedId === id && s.multiSelectedIds.size === 0,
  };
}

export function sameFlags(a: ElementSelectionFlags, b: ElementSelectionFlags): boolean {
  return a.selected === b.selected && a.multi === b.multi && a.single === b.single;
}
