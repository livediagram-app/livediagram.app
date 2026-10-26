// Which items a tab shows (docs/specs/026-plan/items.md "Who may do what"):
// a visitor on a tab-scoped link sees only these. Its Plan cards' items, and,
// with a Plan board or plan view on it, every item (a board shows every card).

import type { Item } from './item';
import { normaliseBoardSetup } from './board';

export interface TabItemElement {
  shape?: string;
  planBoard?: unknown;
  planCard?: { itemId?: unknown };
}

// Whether a tab shows every card: it holds a Plan board, or a plan view (docs/specs/026-plan/plan-views.md "On the
// canvas"), so a card made from it is one it shows. `elements` takes any element list: a weak TabItemElement[]
// would refuse a typed project element union.
export function tabShowsEveryCard(elements: readonly object[]): boolean {
  return (elements as readonly TabItemElement[]).some(
    (el) =>
      (el.shape === 'plan-board' && normaliseBoardSetup(el.planBoard) !== null) ||
      el.shape === 'plan-view',
  );
}

export function itemIdsShownOnTab(elements: readonly object[], items: Iterable<Item>): Set<string> {
  const ids = new Set<string>();
  for (const el of elements as readonly TabItemElement[])
    if (el.shape === 'plan-card' && typeof el.planCard?.itemId === 'string')
      ids.add(el.planCard.itemId);
  if (tabShowsEveryCard(elements)) for (const it of items) ids.add(it.id);
  return ids;
}
