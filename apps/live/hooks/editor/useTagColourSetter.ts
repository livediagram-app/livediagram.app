'use client';

import { useCallback } from 'react';
import { withTagColour, type Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';

// A tag's colour for the active tab (docs/specs/009-elements/tag-colours.md "Editing"): set or cleared in one history
// step, so it undoes like any other change to the board and syncs with the tab.
export function useTagColourSetter({
  activeId,
  canEdit,
  commitTabs,
}: {
  activeId: string;
  canEdit: boolean;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
}): (tag: string, colour: string | null) => void {
  return useCallback(
    (tag: string, colour: string | null) => {
      if (!canEdit) return;
      let changed = false;
      commitTabs((ts) => {
        const next = ts.map((t) => {
          if (t.id !== activeId) return t;
          const after = withTagColour(t, tag, colour);
          if (after !== t) changed = true;
          return after;
        });
        return changed ? next : ts;
      });
      if (changed) track('Element', 'Changed', colour ? 'TagColour' : 'TagColourCleared');
    },
    [activeId, canEdit, commitTabs],
  );
}
