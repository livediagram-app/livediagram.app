// Which items a tab shows (docs/specs/025-plan/items.md "Who may do what"):
// a visitor on a tab-scoped link sees only these. Its Plan cards' items, and
// every item a Plan board on it scopes (in its columns or unplaced).

import type { Item } from './item';
import { boardScopeMatches, normaliseBoardSetup } from './board';

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
  const scopes = [];
  for (const el of elements) {
    if (el.shape === 'plan-card' && typeof el.planCard?.itemId === 'string')
      ids.add(el.planCard.itemId);
    if (el.shape === 'plan-board') {
      const setup = normaliseBoardSetup(el.planBoard);
      if (setup) scopes.push(setup.scope);
    }
  }
  if (scopes.length) {
    for (const it of items) if (scopes.some((s) => boardScopeMatches(s, it))) ids.add(it.id);
  }
  return ids;
}
