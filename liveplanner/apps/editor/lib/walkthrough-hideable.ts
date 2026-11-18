'use client';

// What a walkthrough can hide on each kind of tab (docs/specs/012-collaboration/walkthroughs.md "Hide From
// Recording"): any element on a canvas tab, the cards a Board tab's board shows after its filter (and on a board drawn
// on the canvas), the filled slots on a Dashboard tab, and nothing on a Sheet or Form tab. Handed to @liveworkspace/walkthrough as its
// host's hideable marks (liveworkspace/docs/specs/006-media/walkthroughs.md "What an app can hide").

import { tabKindOf, type DashboardLayout, type Element } from '@liveplanner/project';
import type { WalkthroughHideable } from '@liveworkspace/walkthrough';
import { useMemo } from 'react';
import { fillTabElementOf } from '../components/plan/fill-tab';
import { useShownCards, type ShownCards } from '../hooks/plan/board-shown-store';

// A board's card (PlanBoardCells) and a filled Dashboard slot (DashboardSlotView), each naming its id. An empty slot
// carries no mark, so it can't be picked.
export const WALKTHROUGH_HIDE_MARKS: readonly string[] = [
  'data-plan-card',
  'data-dashboard-widget',
];

export type HideableTab = {
  kind?: string;
  elements: readonly unknown[];
  dashboard?: DashboardLayout | undefined;
};

/**
 * Whether the tab has anything a walkthrough can hide. Cards are the plan's, shown on its boards: `shown` is what the
 * board filling the tab says it draws after its filter (board-shown-store.ts); until it has said, the plan's cards.
 */
export function tabHasHideable(
  tab: HideableTab,
  cardCount: number,
  shown: ShownCards | null = null,
): boolean {
  // A board, Sheet or visualisation filling the tab is drawn over the canvas and covers the rest: only a board's cards
  // can be picked there (a Visualisation tab's view and a Sheet's cells carry no ids).
  const fill = fillTabElementOf(tab.elements as readonly Element[], tab.kind, tab.dashboard);
  if (fill) {
    if (fill.kind !== 'Board') return false;
    return shown?.elementId === fill.id ? shown.any : cardCount > 0;
  }
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
  // Once per tab change, not per editor render: the fill check walks a canvas tab's elements.
  const shown = useShownCards();
  const hasAny = useMemo(() => tabHasHideable(tab, cardCount, shown), [tab, cardCount, shown]);
  return useMemo(
    () => ({
      marks: WALKTHROUGH_HIDE_MARKS,
      canHide: () => hasAny,
      selection: () => selectedCardIds(),
    }),
    [hasAny],
  );
}
