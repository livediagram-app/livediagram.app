'use client';

import { useSyncExternalStore } from 'react';
import type { InsertionSlot } from '@/lib/insert-between';

// The insertion an in-flight drag is OFFERING on an event-storming board
// (spec/139): the gap it would open, and which elements slide right to open
// it. THIS CHANNEL NEVER TOUCHES THE DOCUMENT — the canvas renders the ripple
// as a CSS transform and the drop is the first thing that writes, so a hover
// can't reach the undo stack, autosave, or a peer's screen.
//
// Module-level and framework-shaped (`useSyncExternalStore`) because a drag is
// global, single-at-a-time and transient: threading it down the editor's prop
// tree would be all cost and no meaning. It has TWO publishers — a palette
// drag (usePaletteDragGuides) and a drag of a note already on the board
// (useEditorDrag) — which is exactly why it lives here rather than beside the
// palette's own drag state. Whoever publishes owns clearing it; the drop
// consumes it with `takeInsertionSlot`.

let insertion: InsertionSlot | null = null;
const insertionListeners = new Set<() => void>();

// Cheap value equality so a move that re-resolves the same slot doesn't
// re-render every element view at pointer rate.
function sameSlot(a: InsertionSlot | null, b: InsertionSlot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.atX === b.atX &&
    a.atY === b.atY &&
    a.shiftDx === b.shiftDx &&
    a.rightId === b.rightId &&
    a.shiftedIds.length === b.shiftedIds.length &&
    a.shiftedIds.every((id, i) => id === b.shiftedIds[i])
  );
}

export function setInsertionSlot(next: InsertionSlot | null): void {
  if (sameSlot(insertion, next)) return;
  insertion = next;
  for (const l of insertionListeners) l();
}

export function getInsertionSlot(): InsertionSlot | null {
  return insertion;
}

// Read and clear in one step, for the drop: the slot has done its job the
// moment it is committed, and a slot left behind would ripple the next drag.
export function takeInsertionSlot(): InsertionSlot | null {
  const slot = insertion;
  setInsertionSlot(null);
  return slot;
}

function subscribeInsertion(l: () => void): () => void {
  insertionListeners.add(l);
  return () => {
    insertionListeners.delete(l);
  };
}

export function useInsertionSlot(): InsertionSlot | null {
  return useSyncExternalStore(
    subscribeInsertion,
    () => insertion,
    () => null,
  );
}

// Is a drag that COULD open a slot in hand? True for the whole gesture,
// whether or not Alt is down — which is what makes it two useful things at
// once:
//
//  - the board's easing is mounted before the slot opens and still mounted
//    when it closes (unmount the transition in the same commit that removes
//    the offset and the board snaps shut instead of easing);
//  - the editor can OFFER the gesture ("Press Alt to insert between two
//    notes"), which is the only way anyone discovers a held modifier.
//
// So it means precisely what it says: a single sticky, on an event-storming
// board, being moved. Not "Alt is down", and not "a slot is open".
//
// A palette drag doesn't publish here: its own preview already says what is
// being dragged, and deriving it there is one fewer thing that can leak. This
// flag exists for the drag of a note already on the board, which has no such
// signal.
let noteDragActive = false;
const noteDragListeners = new Set<() => void>();

export function setInsertionDragInHand(next: boolean): void {
  if (noteDragActive === next) return;
  noteDragActive = next;
  for (const l of noteDragListeners) l();
}

function subscribeNoteDrag(l: () => void): () => void {
  noteDragListeners.add(l);
  return () => {
    noteDragListeners.delete(l);
  };
}

export function useInsertionDragInHand(): boolean {
  return useSyncExternalStore(
    subscribeNoteDrag,
    () => noteDragActive,
    () => false,
  );
}
