'use client';

import { useState } from 'react';
import type { PlacementView } from './placement-view';

// The placement browser's view (docs/specs/006-document/save-locations.md, "It opens where its
// selection is"; blueprint default-folders.md "Browser view"). Until the reader moves about in it,
// the view is derived from the selection on every render, so a selection that arrives or changes
// from outside (a late default, Change default, folders still loading) is opened to. Each reader
// move pins the view it leads to, for the placement it leaves selected, so the view never jumps
// under the reader; a placement changed from outside unpins it.

type Pinned = { view: PlacementView; at: string };

export function usePlacementView(placement: string, derived: PlacementView) {
  const [pinned, setPinned] = useState<Pinned | null>(null);
  // Adjusting state while rendering: the host moved the selection, so the pin no longer holds.
  if (pinned && pinned.at !== placement) setPinned(null);
  const view = pinned && pinned.at === placement ? pinned.view : derived;
  return {
    view,
    /** The reader moved: show `next`, with `at` the placement the move leaves selected. */
    move: (next: PlacementView, at: string) => setPinned({ view: next, at }),
  };
}
