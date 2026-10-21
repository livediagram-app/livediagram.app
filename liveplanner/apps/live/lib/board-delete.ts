// Deleting a board with its cards (docs/specs/026-plan/plan-board.md "Deleting a board"): the card types a delete
// would leave no board showing, so the delete can offer to take them and their cards too. A board shows the types its
// Card Types name, or every type when it names none; an Archive board counts as showing every type (it lists any
// card). Pure: the guard reads the tabs and asks.
import { normaliseBoardSetup } from '@liveplanner/items';
import type { Element, Tab } from '@liveplanner/document';

const isBoard = (el: Element) => el.type === 'shape' && el.shape === 'plan-board';

// The types `el` (a board) shows: a set, or 'all'.
function shownBy(el: Element): ReadonlySet<string> | 'all' {
  const setup = normaliseBoardSetup((el as { planBoard?: unknown }).planBoard);
  if (!setup || setup.archive || !setup.addTypes) return 'all';
  return new Set(setup.addTypes);
}

// The card types (of `typeIds`, in that order) the boards among `targetIds` on the active tab show and no other board
// in the document does. Empty when the delete takes no board, or another board shows every type.
export function typesOrphanedBy(
  tabs: readonly Tab[],
  activeTabId: string,
  targetIds: ReadonlySet<string>,
  typeIds: readonly string[],
): string[] {
  const active = tabs.find((t) => t.id === activeTabId);
  const deleted = (active?.elements ?? []).filter((el) => targetIds.has(el.id) && isBoard(el));
  if (deleted.length === 0) return [];
  const candidates = new Set<string>();
  for (const el of deleted) {
    const shown = shownBy(el);
    for (const id of shown === 'all' ? typeIds : typeIds.filter((t) => shown.has(t)))
      candidates.add(id);
  }
  for (const tab of tabs)
    for (const el of tab.elements) {
      if (!isBoard(el) || (tab.id === activeTabId && targetIds.has(el.id))) continue;
      const shown = shownBy(el);
      if (shown === 'all') return [];
      for (const id of shown) candidates.delete(id);
    }
  return typeIds.filter((id) => candidates.has(id));
}
