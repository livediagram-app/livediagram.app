'use client';

import { useSyncExternalStore } from 'react';

// The timeline lane an in-flight drag is LANDING ON (spec/139 Phase 6), for
// the overlay that lights it. Same discipline as `insertion-preview.ts`: this
// channel NEVER touches the document — the drop is the first thing that
// writes, so a hover cannot reach the undo stack, autosave, or a peer's
// screen.
//
// Module-level and framework-shaped (`useSyncExternalStore`) for the same
// reason the insertion slot is: a drag is global, single-at-a-time and
// transient, and it has TWO publishers — a palette drag (usePaletteDragGuides)
// and a drag of a note already on the board (useEditorDrag). Whoever publishes
// owns clearing it.

export type LanePreview = {
  // The lane the note's centre is landing on, or null when the note is too
  // far from any lane for one to claim it (lanes are an aid, not a cage).
  laneIndex: number | null;
  // The exact footprint the drop will take, when a suggested slot has claimed
  // the note: drawn as a dashed outline so the author sees where it is going
  // BEFORE letting go. Absent when x is still the hand's own.
  ghost?: { x: number; y: number; width: number; height: number };
};

let preview: LanePreview | null = null;
const listeners = new Set<() => void>();

// Cheap value equality: a drag re-resolves the same lane on every pointer
// move, and the overlay must not re-render at pointer rate for no change.
function same(a: LanePreview | null, b: LanePreview | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.laneIndex === b.laneIndex &&
    a.ghost?.x === b.ghost?.x &&
    a.ghost?.y === b.ghost?.y &&
    a.ghost?.width === b.ghost?.width &&
    a.ghost?.height === b.ghost?.height
  );
}

export function setLanePreview(next: LanePreview | null): void {
  if (same(preview, next)) return;
  preview = next;
  for (const l of listeners) l();
}

export function getLanePreview(): LanePreview | null {
  return preview;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLanePreview(): LanePreview | null {
  return useSyncExternalStore(
    subscribe,
    () => preview,
    () => null,
  );
}
