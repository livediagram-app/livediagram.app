// Deleting a board with its cards (docs/specs/026-plan/plan-board.md "Deleting a board"). Before a delete that takes a
// board, the guard finds the card types no other board would show (typesOrphanedBy) and offers, optionally, to delete
// them and their cards too, as deleting a card type does (its cards to the Trash). The board goes either way: keeping
// the cards is the default, and closing the question keeps them. It asks only once every tab has loaded, since a board
// on an unloaded tab could still show those types.
import { useCallback } from 'react';
import { isTrashed, type Item, type ItemTypeDef } from '@livediagram/items';
import type { Tab } from '@livediagram/document';
import { typesOrphanedBy } from '@/lib/board-delete';
import { track } from '@/lib/telemetry';
import type { SheetDeleteGuard } from '@/hooks/sheets/useSheetDeleteGuard';

type Confirm = (opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => Promise<boolean>;

const listOf = (labels: readonly string[]) =>
  labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

export function boardDeleteCopy(
  labels: readonly string[],
  cards: number,
): { title: string; message: string } {
  const one = labels.length === 1;
  const types = `the ${listOf(labels)} card ${one ? 'type' : 'types'}`;
  const owner = one ? 'Its' : 'Their';
  const tail =
    cards === 0
      ? `No cards use ${one ? 'it' : 'them'}.`
      : cards === 1
        ? `${owner} 1 card goes to the Trash, where it can be restored.`
        : `${owner} ${cards} cards go to the Trash, where they can be restored.`;
  return {
    title: 'Delete Its Cards Too?',
    message: `No other board shows ${listOf(labels)}. Delete ${types} too? ${tail}`,
  };
}

// The guard, for elements on the active tab or (a tab being deleted) on `tabId`.
type BoardDeleteGuard = (
  targetIds: ReadonlySet<string>,
  tabId?: string,
) => ReturnType<SheetDeleteGuard>;

export function useBoardDeleteGuard(deps: {
  readTabs: () => readonly Tab[];
  activeTabId: string;
  confirm: Confirm;
  // Every tab's content has arrived (a board on an unloaded tab is unknown).
  allTabsLoaded: () => boolean;
  types: readonly ItemTypeDef[];
  items: ReadonlyMap<string, Item>;
  trashItems: (itemIds: readonly string[]) => number;
  deleteType: (typeId: string) => void;
}): BoardDeleteGuard {
  const { readTabs, activeTabId, confirm, allTabsLoaded, types, items, trashItems, deleteType } =
    deps;
  return useCallback(
    (targetIds, tabId = activeTabId) => {
      if (!allTabsLoaded() || types.length === 0) return null;
      const ids = typesOrphanedBy(
        readTabs(),
        tabId,
        targetIds,
        types.map((t) => t.id),
      );
      if (ids.length === 0) return null;
      const orphan = new Set(ids);
      const cards = [...items.values()].filter((i) => orphan.has(i.type) && !isTrashed(i));
      const labels = ids.map((id) => types.find((t) => t.id === id)?.label ?? id);
      return confirm({
        ...boardDeleteCopy(labels, cards.length),
        confirmLabel: 'Delete Cards Too',
        cancelLabel: 'Keep Them',
      }).then((ok) => {
        track('Plan', 'Deleted', ok ? 'BoardWithCards' : 'BoardOnly');
        return {
          release: ok
            ? () => {
                trashItems(cards.map((c) => c.id));
                for (const id of ids) deleteType(id);
              }
            : () => {},
        };
      });
    },
    [allTabsLoaded, types, readTabs, activeTabId, items, confirm, trashItems, deleteType],
  );
}
