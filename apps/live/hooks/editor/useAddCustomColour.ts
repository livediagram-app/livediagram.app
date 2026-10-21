'use client';

import { useCallback } from 'react';
import { withCustomColour, type Tab } from '@livediagram/document';

// Keeps a colour picked with + as the active tab's newest custom colour (docs/specs/004-interface-design/
// colour-picker.md "Custom colours"), so every picker in the document offers it. Not an undoable step: it
// records a choice, it does not change the board (the pick itself is the undoable edit). Synced with the tab.
export function useAddCustomColour({
  activeId,
  canEdit,
  tickTabs,
}: {
  activeId: string;
  canEdit: boolean;
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
}): (hex: string) => void {
  return useCallback(
    (hex: string) => {
      if (!canEdit) return;
      tickTabs((ts) => {
        let changed = false;
        const next = ts.map((t) => {
          if (t.id !== activeId) return t;
          const after = withCustomColour(t, hex);
          changed = after !== t;
          return after;
        });
        return changed ? next : ts;
      });
    },
    [activeId, canEdit, tickTabs],
  );
}
