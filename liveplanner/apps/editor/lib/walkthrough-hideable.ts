'use client';

// What a walkthrough can hide on each kind of tab (docs/specs/012-collaboration/walkthroughs.md "Hide From
// Recording"): any element on a canvas tab, the cards on a Board tab (and on a board drawn on the canvas), the
// filled slots on a Dashboard tab, and nothing on a Sheet or Form tab. Handed to @liveworkspace/walkthrough as its
// host's hideable marks (liveworkspace/docs/specs/006-media/walkthroughs.md "What an app can hide").

import { tabKindOf, type DashboardLayout } from '@liveplanner/project';
import type { WalkthroughHideable } from '@liveworkspace/walkthrough';
import { useMemo } from 'react';

// A board's card (PlanBoardCells) and a Dashboard slot (DashboardSlotView), each naming its id.
export const WALKTHROUGH_HIDE_MARKS: readonly string[] = ['data-plan-card', 'data-dashboard-slot'];

export type HideableTab = {
  kind?: string;
  elements: readonly unknown[];
  dashboard?: DashboardLayout | undefined;
};

/** Whether the tab has anything a walkthrough can hide. Cards are the plan's, shown on its boards. */
export function tabHasHideable(tab: HideableTab, cardCount: number): boolean {
  switch (tabKindOf(tab)) {
    case 'diagram':
      return tab.elements.length > 0;
    case 'board':
      return cardCount > 0;
    case 'dashboard':
      return (tab.dashboard?.rows ?? []).some((row) => row.slots.some((slot) => !!slot.content));
    case 'sheet':
    case 'form':
      return false;
  }
}

/** The cards selected on the boards showing, for Hide Selection: read at the press, never while drawing. */
export function selectedCardIds(root: ParentNode = document): string[] {
  const ids = new Set<string>();
  for (const el of root.querySelectorAll('[data-plan-card][data-selected]')) {
    const id = el.getAttribute('data-plan-card');
    if (id) ids.add(id);
  }
  return [...ids];
}

/** The host's hideable marks, for the tab showing: the marks themselves never change. */
export function useWalkthroughHideable(tab: HideableTab, cardCount: number): WalkthroughHideable {
  const hasAny = tabHasHideable(tab, cardCount);
  return useMemo(
    () => ({
      marks: WALKTHROUGH_HIDE_MARKS,
      canHide: () => hasAny,
      selection: () => selectedCardIds(),
    }),
    [hasAny],
  );
}
