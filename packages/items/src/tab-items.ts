// Which items a tab shows (docs/specs/025-plan/items.md "Who may do what"):
// a visitor on a tab-scoped link sees only these. Its Plan cards' items, and,
// with a Plan board or plan view on it, every item (a board shows every card).

import type { Item } from './item';
import { normaliseBoardSetup } from './board';

export interface TabItemElement {
  shape?: string;
  planBoard?: unknown;
  planCard?: { itemId?: unknown };
}

export function itemIdsShownOnTab(
  elements: readonly TabItemElement[],
  items: Iterable<Item>,
): Set<string> {
  const ids = new Set<string>();
  let board = false;
  for (const el of elements) {
    if (el.shape === 'plan-card' && typeof el.planCard?.itemId === 'string')
      ids.add(el.planCard.itemId);
    if (el.shape === 'plan-board' && normaliseBoardSetup(el.planBoard)) board = true;
    // A plan view reads every card (docs/specs/025-plan/plan-views.md "On the canvas").
    if (el.shape === 'plan-view') board = true;
  }
  if (board) for (const it of items) ids.add(it.id);
  return ids;
}
