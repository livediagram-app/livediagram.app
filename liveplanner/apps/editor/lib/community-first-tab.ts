import { readForm, questionsOf } from '@liveplanner/forms';
import { itemIdsShownOnTab, type Item } from '@liveplanner/items';
import { tabKindOf } from '@liveplanner/project';

// Whether the plan's first tab, as the editor holds it, has nothing to show on a Community card
// (docs/specs/025-community/community.md "Something to show"): a Board with no card, a Dashboard with no part, a
// Form with no question. Counted, never rendered. A Sheet's values live in its own store, which the editor reads
// lazily, so a Sheet is never called empty here: the server's refusal says it. Only a tab the editor holds whole
// (its elements loaded) is judged; a board whose cards have not loaded yet is not called empty either.
export function firstTabIsEmpty(
  tab: { kind?: string; elements: readonly object[]; form?: unknown },
  items: ReadonlyMap<string, Item> | null,
): boolean {
  switch (tabKindOf(tab)) {
    case 'board':
      return items !== null && itemIdsShownOnTab(tab.elements, items.values()).size === 0;
    case 'dashboard':
      return tab.elements.length === 0;
    case 'form': {
      const form = readForm(tab.form);
      return form === null || questionsOf(form).length === 0;
    }
    case 'sheet':
      return false;
    default:
      return tab.elements.length === 0;
  }
}
