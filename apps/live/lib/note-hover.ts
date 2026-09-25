'use client';

import { useSyncExternalStore } from 'react';

// The workshop note the pointer is OVER, so a note can offer its next-note
// buttons on hover as well as on selection (spec/139 Phase 7). Published from
// the note itself (it already tracks enter / leave) rather than tracked
// canvas-wide: a pointer-move listener over the whole board, at pointer rate,
// to answer a question one element already knows would be the expensive way
// round. A module-level store read with `useSyncExternalStore`, like every
// other in-flight canvas preview; it never touches the document.

let hoveredId: string | null = null;
const listeners = new Set<() => void>();

export function setHoveredNoteId(next: string | null): void {
  if (hoveredId === next) return;
  hoveredId = next;
  for (const l of listeners) l();
}

// Clear only if this note is still the one being reported — a leave that
// arrives AFTER the next note's enter must not blank its neighbour.
export function clearHoveredNoteId(id: string): void {
  if (hoveredId === id) setHoveredNoteId(null);
}

export function useHoveredNoteId(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => hoveredId,
    () => null,
  );
}
