import { useSyncExternalStore } from 'react';

// What a Sankey tour step lifts on the canvas (docs/specs/007-editor/element-tours.md "The Sankey tour"): one band or
// one node of one diagram, drawn as a hover would draw it, readout and all, while the step is up. A real hover wins
// over it. A module store: one editor per page, and at most one tour running.

export type SankeyTourFocus = {
  elementId: string;
  part: 'band' | 'node';
  index: number;
};

let current: SankeyTourFocus | null = null;
const listeners = new Set<() => void>();

export function setSankeyTourFocus(next: SankeyTourFocus | null): void {
  if (
    next === current ||
    (next &&
      current &&
      next.elementId === current.elementId &&
      next.part === current.part &&
      next.index === current.index)
  )
    return;
  current = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The lifted part of this diagram, or null (a diagram the tour is not on never re-renders for it). */
export function useSankeyTourFocus(elementId: string | null): SankeyTourFocus | null {
  return useSyncExternalStore(
    subscribe,
    () => (elementId !== null && current?.elementId === elementId ? current : null),
    () => null,
  );
}
