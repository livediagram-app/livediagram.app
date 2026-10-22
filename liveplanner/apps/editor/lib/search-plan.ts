// The search panel's Plan results (docs/specs/008-canvas/canvas-and-palette.md "Search panel"): the open project's
// boards, by title, and its cards, by number or by the words of their title or description, as the Cards panel's Find
// matches them (@liveplanner/items cardMatches). Pure, for buildSearchResults.
//
// Fast at a project's size: a keystroke walks each card once, reading the lowercased text Find already caches per card
// version, and keeps only the best few; the tab a card shows on is worked out for those few alone.
import type { Tab } from '@liveplanner/project';
import {
  boardShowsType,
  cardMatches,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  normaliseBoardSetup,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';

export const BOARD_RESULT_LIMIT = 8;
export const CARD_RESULT_LIMIT = 8;

export type BoardResult = {
  kind: 'board';
  // The board element's id: unique across the project.
  id: string;
  tabId: string;
  tabName: string;
  name: string;
};

export type CardResult = {
  kind: 'card';
  // The card's item id.
  id: string;
  key: number;
  name: string;
  // The tab whose board shows it, when one does: picking it opens that tab under the card.
  tab?: { id: string; name: string };
};

// What the editor hands search for its cards: every card, and the tab a card shows on.
export type CardSearchSource = {
  items: ReadonlyMap<string, Item>;
  tabOf?: (item: Item) => { id: string; name: string } | null;
};

/** The boards whose title holds `q`, in tab order. A board titled as its own tab is left to the Tabs group. */
export function boardResults(q: string, tabs: readonly Tab[]): BoardResult[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: BoardResult[] = [];
  for (const t of tabs)
    for (const el of t.elements) {
      if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
      const title = (el.planBoard as { title?: unknown } | undefined)?.title;
      if (typeof title !== 'string' || !title.trim()) continue;
      const name = title.trim();
      if (!name.toLowerCase().includes(needle)) continue;
      if (name.toLowerCase() === t.name.trim().toLowerCase()) continue;
      out.push({ kind: 'board', id: el.id, tabId: t.id, tabName: t.name, name });
      if (out.length >= BOARD_RESULT_LIMIT) return out;
    }
  return out;
}

// How well a card answers the query: its number (0), its title (1), else only its description (2).
function rankOf(item: Item, needle: string): number {
  if (String(item.key) === needle) return 0;
  return itemTitle(item).toLowerCase().includes(needle) ? 1 : 2;
}

type Ranked = { item: Item; rank: number };
const before = (a: Ranked, b: Ranked) => a.rank - b.rank || b.item.updatedAt - a.item.updatedAt;

/** The cards that answer `q` (neither archived nor in the Trash), best first: its number, then a title holding the
 *  words, then a description; the most recently changed first within each. Only on a query: an empty one lists none. */
export function cardResults(q: string, source: CardSearchSource): CardResult[] {
  const needle = q.trim().toLowerCase().replace(/^#/, '');
  if (!needle) return [];
  // The best few so far, kept sorted: a short insertion, never a sort of every match.
  const best: Ranked[] = [];
  for (const item of source.items.values()) {
    if (isTrashed(item) || isArchived(item) || !cardMatches(item, needle)) continue;
    const next = { item, rank: rankOf(item, needle) };
    if (best.length === CARD_RESULT_LIMIT && before(next, best[best.length - 1]!) >= 0) continue;
    let at = best.length;
    while (at > 0 && before(next, best[at - 1]!) < 0) at--;
    best.splice(at, 0, next);
    if (best.length > CARD_RESULT_LIMIT) best.pop();
  }
  return best.map(({ item }) => {
    const tab = source.tabOf?.(item) ?? null;
    return {
      kind: 'card',
      id: item.id,
      key: item.key,
      name: itemTitle(item) || 'Untitled',
      ...(tab ? { tab } : {}),
    };
  });
}

/** The tab a card shows on, for search to open it there (docs/specs/026-plan/plan-board.md "Card types a board
 *  shows"): the first tab, in tab order, with a board holding a column for its status that shows its type; else the
 *  first with an All Cards board that shows its type; else none. Built once per open of the panel; asked only of the
 *  few cards listed. */
export function cardTabResolver(
  tabs: readonly Tab[],
  types?: readonly { id: string }[],
): (item: Item) => { id: string; name: string } | null {
  const boards: { tab: { id: string; name: string }; setup: PlanBoardSetup }[] = [];
  for (const t of tabs)
    for (const el of t.elements) {
      if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
      const setup = normaliseBoardSetup(el.planBoard);
      if (setup && !setup.archive) boards.push({ tab: { id: t.id, name: t.name }, setup });
    }
  return (item) => {
    const status = itemStatus(item);
    let all: { id: string; name: string } | null = null;
    for (const { tab, setup } of boards) {
      if (!boardShowsType(setup, item.type, types)) continue;
      if (setup.allCards) all ??= tab;
      else if (status && setup.columns.some((c) => c.status === status)) return tab;
    }
    return all;
  };
}
