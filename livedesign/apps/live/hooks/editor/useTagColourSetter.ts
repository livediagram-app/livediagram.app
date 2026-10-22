'use client';

import { useCallback } from 'react';
import { withTagColour, type Tab } from '@livepages/document';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';

// A tag's colour for the active tab (docs/specs/009-elements/tag-colours.md "Editing"): set or cleared in one history
// step, so it undoes like any other change to the board and syncs with the tab. Whether it changes anything is read
// from the tab as it is now, not from inside the commit's updater, which React may run after this returns.
export function useTagColourSetter({
  activeTab,
  canEdit,
  commitTabs,
}: {
  activeTab: Tab;
  canEdit: boolean;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
}): (tag: string, colour: string | null) => void {
  // Read when a colour is picked, so the setter stays the same one across edits of the tab (it reaches the menus
  // through the editor context, which would otherwise re-render them on every edit).
  const tabRef = useLatest(activeTab);
  return useCallback(
    (tag: string, colour: string | null) => {
      const activeTab = tabRef.current;
      if (!canEdit || withTagColour(activeTab, tag, colour) === activeTab) return;
      commitTabs((ts) => {
        let changed = false;
        const next = ts.map((t) => {
          if (t.id !== activeTab.id) return t;
          const after = withTagColour(t, tag, colour);
          if (after !== t) changed = true;
          return after;
        });
        return changed ? next : ts;
      });
      track('Element', 'Changed', colour ? 'TagColour' : 'TagColourCleared');
    },
    [tabRef, canEdit, commitTabs],
  );
}
