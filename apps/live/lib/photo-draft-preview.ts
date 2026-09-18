'use client';

import { useSyncExternalStore } from 'react';

// What the IMPORTING session sees around a photo draft (spec/139 Phase 8), and
// only that session: which notes on the board the photo matched, and what the
// photo read them as when it differed.
//
// Local on purpose. The draft NOTES are in the document (a peer should see the
// notes arriving, and a reload should not lose them), but the fade of
// everything else and the "already here" badges are a reading aid for the
// person holding the photo — a peer who happens to be editing the same board
// should not have their canvas dim because somebody else is importing.
//
// Module-level and framework-shaped, like every other transient canvas fact
// here: one draft at a time, global to the session, gone on accept or discard.

export type PhotoDraftView = {
  // Ids of notes ALREADY on the board that the photo matched.
  matchedIds: ReadonlySet<string>;
  // For a matched note whose photo text differed: what the photo read.
  differences: ReadonlyMap<string, string>;
  // Counts for the draft bar's one line.
  read: number;
};

let view: PhotoDraftView | null = null;
const listeners = new Set<() => void>();

export function setPhotoDraftView(next: PhotoDraftView | null): void {
  if (view === next) return;
  view = next;
  for (const l of listeners) l();
}

export function getPhotoDraftView(): PhotoDraftView | null {
  return view;
}

export function usePhotoDraftView(): PhotoDraftView | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => view,
    () => null,
  );
}
