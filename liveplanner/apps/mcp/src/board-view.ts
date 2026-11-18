// What the interactive view draws of a plan (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): one
// tab's boards, each column with its count and the cards that fit, in the board's own order. Pure over the reads
// list_items makes (the items and the plan): the cards are grouped by column in one pass, and only the cards drawn
// are shaped, so a 2,000-card board costs a sort, not a listing.
import {
  boardShowsType,
  compareRank,
  doneStatusesOf,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  sortCards,
  typeIn,
  type Item,
  type PlanBoardOutline,
  cardRefOrKey,
} from '@liveplanner/items';
import type { PlanState } from '@liveplanner/agent-verbs';

// Draw only what fits (the spec's VIEW_*): the cards a column draws, the cards the view draws in all, and the
// longest title it carries. Safe ranges: 10 to 50 a column, 100 to 500 in all, 80 to 200 characters.
export const VIEW_BOARD_COLUMN_CARDS = 30;
export const VIEW_BOARD_CARDS = 300;
export const VIEW_CARD_TITLE_MAX = 120;

const HEX_COLOUR = /^#[0-9a-f]{3,8}$/i;

export type ViewCard = { id: string; ref: string; title: string; color: string | null };
export type ViewColumn = {
  name: string;
  status: string;
  count: number;
  wipLimit: number | null;
  done: boolean;
  cards: ViewCard[];
};
export type ViewBoard = { id: string; title: string; columns: ViewColumn[] };
export type BoardView = {
  tabId: string;
  name: string;
  tabs: { id: string; name: string }[];
  boards: ViewBoard[];
};

const cut = (text: string) =>
  text.length > VIEW_CARD_TITLE_MAX ? `${text.slice(0, VIEW_CARD_TITLE_MAX - 1).trimEnd()}…` : text;

/**
 * The boards the view draws on `tabId`, or on the plan's first board tab when that tab has none (or none is named).
 * Only filed boards draw: the All Cards and Archive boards are left out. No board at all is an empty view.
 */
export function boardView(state: PlanState, tabId?: string): BoardView {
  const { plan } = state;
  const filed = plan.boards.filter((b) => b.kind === 'board');
  const tabs: BoardView['tabs'] = [];
  for (const b of filed)
    if (!tabs.some((t) => t.id === b.tabId)) tabs.push({ id: b.tabId, name: b.tabName });
  const shown = tabs.find((t) => t.id === tabId) ?? tabs[0];
  if (!shown) return { tabId: tabId ?? '', name: '', tabs, boards: [] };

  // The live cards in rank order, grouped by status once.
  const byStatus = new Map<string, Item[]>();
  const live = state.items
    .filter((i) => !isTrashed(i) && !isArchived(i))
    .sort((a, b) => compareRank(a.rank, b.rank) || a.key - b.key);
  for (const i of live) {
    const status = itemStatus(i);
    if (status === undefined) continue;
    const list = byStatus.get(status);
    if (list) list.push(i);
    else byStatus.set(status, [i]);
  }
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const isDone = doneStatusesOf(plan.boards);
  const card = (i: Item): ViewCard => {
    const color = typeIn(plan.types, i.type).color;
    return {
      id: i.id,
      // Its number with its type's prefix ("WI-12"; docs/specs/026-plan/item-types.md "Card number prefixes").
      ref: cardRefOrKey(i, plan.types),
      title: cut(itemTitle(i)),
      color: HEX_COLOUR.test(color) ? color : null,
    };
  };

  let room = VIEW_BOARD_CARDS;
  const column = (b: PlanBoardOutline, c: PlanBoardOutline['columns'][number]): ViewColumn => {
    const all = (byStatus.get(c.status) ?? []).filter((i) =>
      boardShowsType({ addTypes: b.types ?? undefined }, i.type, plan.types),
    );
    const take = Math.min(VIEW_BOARD_COLUMN_CARDS, room);
    // The board's own order, worked out only for what is drawn when it sorts by rank.
    const drawn = b.sortBy?.length
      ? sortCards(all, b.sortBy, plan.types, byId, isDone).slice(0, take)
      : all.slice(0, take);
    room -= drawn.length;
    return {
      name: c.name,
      status: c.status,
      count: all.length,
      wipLimit: c.wipLimit ?? null,
      done: c.done === true,
      cards: drawn.map(card),
    };
  };
  const boards = filed
    .filter((b) => b.tabId === shown.id)
    .map((b) => ({ id: b.elementId, title: b.title, columns: b.columns.map((c) => column(b, c)) }));
  return { tabId: shown.id, name: shown.name, tabs, boards };
}
