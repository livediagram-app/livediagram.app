// The plan's boards as the Overview reads them (docs/specs/026-plan/plan-overview.md "Tabs", "Card Types", "Recent
// Activity"): each Board tab's board set-up, the cards grouped by status once, and which board shows a card. Pure, so
// every derivation the page makes walks the cards once rather than once per board.
import {
  TRASH_STATUS,
  boardShowsType,
  isArchived,
  isTrashed,
  itemStatus,
  normaliseBoardSetup,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';

// `elementId`: the board element's id, which the plan's board edits address (addTypeToBoard).
export type OverviewBoard = {
  tabId: string;
  tabName: string;
  elementId: string;
  setup: PlanBoardSetup;
};

// The board a Board tab holds, with its element's id, read safely; null for any other tab or an unreadable board.
function boardElementOfTab(tab: Tab): { id: string; setup: PlanBoardSetup } | null {
  if (tab.kind !== 'board') return null;
  for (const el of tab.elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const setup = normaliseBoardSetup(el.planBoard);
    return setup ? { id: el.id, setup } : null;
  }
  return null;
}

// The board a Board tab holds, read safely; null for any other tab or an unreadable board.
export function boardOfTab(tab: Tab): PlanBoardSetup | null {
  return boardElementOfTab(tab)?.setup ?? null;
}

// Every Board tab's board, in tab order.
export function boardsOf(tabs: readonly Tab[]): OverviewBoard[] {
  const out: OverviewBoard[] = [];
  for (const tab of tabs) {
    const board = boardElementOfTab(tab);
    if (board)
      out.push({ tabId: tab.id, tabName: tab.name, elementId: board.id, setup: board.setup });
  }
  return out;
}

// The cards by status, each group in rank order; trashed cards under TRASH_STATUS, cards with no status under ''.
export function cardsByStatus(items: Iterable<Item>): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = isTrashed(it) ? TRASH_STATUS : (itemStatus(it) ?? '');
    const group = groups.get(key);
    if (group) group.push(it);
    else groups.set(key, [it]);
  }
  for (const group of groups.values())
    group.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.key - b.key));
  return groups;
}

// Whether `setup`'s board shows `item` (docs/specs/026-plan/plan-board.md "Card types a board shows"): never a
// trashed card; an Archive board its archived cards, any other board its unarchived ones in its columns (an All Cards
// board in any status); and only the card types it takes.
export function boardShows(
  setup: PlanBoardSetup,
  item: Item,
  types: readonly ItemTypeDef[],
  statuses: ReadonlySet<string>,
): boolean {
  if (isTrashed(item)) return false;
  if (setup.archive) {
    if (!isArchived(item)) return false;
  } else {
    if (isArchived(item)) return false;
    if (!setup.allCards && !statuses.has(itemStatus(item) ?? '')) return false;
  }
  return boardShowsType(setup, item.type, types);
}

// The statuses a board's columns name.
export const boardStatuses = (setup: PlanBoardSetup): ReadonlySet<string> =>
  new Set(setup.columns.map((c) => c.status));
