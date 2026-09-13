'use client';

import { useMemo } from 'react';
import { usePaletteDragPreview } from '@/lib/palette-drag-preview';
import { useInsertionNoteDragActive, useInsertionSlot } from '@/lib/insertion-preview';

// How far each element is standing aside, right now, to show the insertion a
// drag is offering (spec/139 insert between). Read from the drag's
// module store rather than threaded through props — a drag is global,
// single-at-a-time and transient, the same reason the ghost reads it there.
//
// This is the ONLY thing the canvas does with an in-flight slot: render it.
// Nothing here touches the document, so a hover can't reach the undo stack,
// autosave, or a peer's screen.
export type InsertShift = {
  // Canvas-unit offset for one element, or undefined when it isn't moving.
  // Undefined rather than 0 so the memoised element views keep stable props
  // on the overwhelmingly common "no slot open" path.
  xFor: (id: string) => number | undefined;
  // Whether the slot's easing should be mounted. True for the WHOLE drag, not
  // just while a slot is open: were the transition removed in the same commit
  // as the offset, the board would snap shut instead of easing.
  animates: boolean;
};

export function useInsertShift(): InsertShift {
  const slot = useInsertionSlot();
  // Either entry point counts as "a drag is in hand": a palette note on its
  // way in, or a note already on the board being moved. Both subscriptions are
  // read unconditionally — `||` between two hook calls would skip one of them.
  const draggingIn = usePaletteDragPreview() !== null;
  const movingNote = useInsertionNoteDragActive();
  const dragging = draggingIn || movingNote;
  const shiftedIds = useMemo(() => (slot ? new Set(slot.shiftedIds) : null), [slot]);
  return {
    xFor: (id: string) => (shiftedIds?.has(id) ? slot?.shiftDx : undefined),
    animates: dragging,
  };
}
