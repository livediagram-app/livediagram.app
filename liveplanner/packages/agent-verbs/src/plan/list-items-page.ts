// list_items' answer, a page at a time (docs/specs/026-plan/plan-agents.md "What list_items leaves out unless asked",
// "Filters", "Paging"; Work Tracker 900): the open cards by default, without their formatting runs, narrowed by card
// types, columns, text and when they changed, and cut into pages that never pass LIST_ITEMS_BUDGET characters. The
// answer always says what it left out.
import {
  doneStatusesOf,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  type Item,
} from '@liveplanner/items';
import type { PictureLink } from './card-pictures';
import {
  NO_BOARD_HINT,
  itemLister,
  listedBoards,
  listedTypes,
  passesListingFilter,
  type ListedBoard,
  type ListedItem,
  type ListedType,
  type ResolvedListingFilter,
} from './plan-listing';
import type { PlanState } from './plan-state';

import { LIST_ITEMS_BUDGET, LIST_ITEMS_LIMIT_MAX } from './list-items-limits';

export * from './list-items-limits';

const CURSOR_PREFIX = 'after-';
const CURSOR = /^after-(\d{1,9})$/;

// How a page is asked for, as the caller gave it.
export interface ListItemsPageArgs {
  query?: string | undefined;
  updatedSince?: string | undefined;
  includeClosed?: boolean | undefined;
  includeRich?: boolean | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

// The same, read: the text lower-cased, the time in ms, the cursor as the last card number listed.
export interface ListItemsPage {
  query?: string;
  updatedSince?: number;
  includeClosed: boolean;
  includeRich: boolean;
  limit: number;
  after: number;
}

type PageRefusal = { ok: false; code: string; message: string };

export function resolveListItemsPage(
  args: ListItemsPageArgs,
): ({ ok: true } & ListItemsPage) | PageRefusal {
  const out: ListItemsPage = {
    includeClosed: args.includeClosed === true,
    includeRich: args.includeRich === true,
    limit: Math.min(args.limit ?? LIST_ITEMS_LIMIT_MAX, LIST_ITEMS_LIMIT_MAX),
    after: 0,
  };
  const query = args.query?.trim().toLowerCase();
  if (query) out.query = query;
  if (args.updatedSince !== undefined) {
    const at = Date.parse(args.updatedSince);
    if (Number.isNaN(at))
      return {
        ok: false,
        code: 'updated_since_invalid',
        message: `updatedSince "${args.updatedSince}" is not a date: give an ISO date or time, such as 2026-11-01 or 2026-11-01T09:00:00Z.`,
      };
    out.updatedSince = at;
  }
  if (args.cursor !== undefined) {
    const m = CURSOR.exec(args.cursor);
    if (!m)
      return {
        ok: false,
        code: 'cursor_invalid',
        message: `cursor "${args.cursor}" is not one list_items gave: call it again without cursor for the first page.`,
      };
    out.after = Number(m[1]);
  }
  return { ok: true, ...out };
}

export interface ListItemsOmitted {
  // Closed cards (in a done column, trashed or archived) that matched the other filters.
  closed?: number;
  // A listed card's formatting runs were left out.
  rich?: true;
  note: string;
}

// A type, not an interface, so it passes as the MCP's structured content.
export type ListItemsAnswer = {
  boards: ListedBoard[];
  notOnBoard: string[];
  count: number;
  total: number;
  items: ListedItem[];
  types: ListedType[];
  omitted?: ListItemsOmitted;
  nextCursor?: string;
  hint?: string;
  url: string;
};

// What was left out, in words, with the switch that brings it back.
export function omittedNote(closed: number, rich: boolean): string {
  const parts: string[] = [];
  if (closed > 0)
    parts.push(
      `${closed} closed card${closed === 1 ? '' : 's'} (in a done column such as Done or Cancelled, trashed or ` +
        'archived) left out: pass includeClosed: true to list them, or name their column in status.',
    );
  if (rich)
    parts.push(
      'Formatting runs (descriptionRich, <field>Rich) left out: the plain text is under each field’s name; pass ' +
        'includeRich: true for them.',
    );
  return parts.join(' ');
}

function omittedOf(closed: number, rich: boolean): ListItemsOmitted | undefined {
  if (closed === 0 && !rich) return undefined;
  return {
    ...(closed > 0 ? { closed } : {}),
    ...(rich ? { rich: true as const } : {}),
    note: omittedNote(closed, rich),
  };
}

// The characters one more card adds to the answer's text: its JSON, indented four more spaces a line under `items`,
// and the comma and line break before the next.
function cardCost(card: ListedItem): number {
  const text = JSON.stringify(card, null, 2);
  let lines = 1;
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) lines += 1;
  return text.length + 4 * lines + 2;
}

const isClosed = (isDone: (status: string | undefined) => boolean, i: Item) =>
  isTrashed(i) || isArchived(i) || isDone(itemStatus(i));

const holdsText = (i: Item, query: string) => {
  if (itemTitle(i).toLowerCase().includes(query)) return true;
  const description = i.fields['description'];
  return typeof description === 'string' && description.toLowerCase().includes(query);
};

// The cards a resolved filter and page's narrowing keep (types, columns, text, when they changed, closed or not), by
// number, with how many closed ones matched the rest and were left out: what list_items pages and `item ls` lists
// whole (Work Tracker 913). One pass over the cards.
export function keptListItems(
  state: PlanState,
  filter: ResolvedListingFilter,
  page: Pick<ListItemsPage, 'query' | 'updatedSince' | 'includeClosed'>,
): { kept: Item[]; closed: number; closedOut: boolean } {
  const isDone = doneStatusesOf(state.plan.boards);
  // A column filter lists every card in the columns it names, closed or not.
  const closedOut = !page.includeClosed && !filter.statuses;
  let closed = 0;
  const kept: Item[] = [];
  for (const i of state.items) {
    if (!passesListingFilter(filter, i)) continue;
    if (page.updatedSince !== undefined && i.updatedAt < page.updatedSince) continue;
    if (page.query !== undefined && !holdsText(i, page.query)) continue;
    if (closedOut && isClosed(isDone, i)) {
      closed += 1;
      continue;
    }
    kept.push(i);
  }
  kept.sort((a, b) => a.key - b.key);
  return { kept, closed, closedOut };
}

// One page of list_items: the cards a resolved filter and page keep, by number after the cursor, until the limit or
// the budget. Only the cards listed (and the one that stops the page) have their fields worked out.
export function listItemsPage(
  state: PlanState,
  filter: ResolvedListingFilter,
  page: ListItemsPage,
  { pictureLink, url }: { pictureLink?: PictureLink; url: string },
): ListItemsAnswer {
  const { plan } = state;
  const { kept, closed, closedOut } = keptListItems(state, filter, page);
  // Whether the card just built had formatting left out, and whether any listed card had.
  let cardRich: boolean;
  let richLeftOut = false;
  const lister = itemLister(
    state,
    pictureLink,
    page.includeRich ? true : { onLeftOut: () => (cardRich = true) },
  );
  const { boards, notOnBoard } = listedBoards(state, { closedOut });
  const frame: ListItemsAnswer = {
    boards,
    notOnBoard,
    count: kept.length,
    total: kept.length,
    items: [],
    types: listedTypes(plan.types, plan.statuses),
    ...(plan.boards.length === 0 ? { hint: NO_BOARD_HINT } : {}),
    url,
  };
  // The frame at its largest: every count as the total, the rich note, the last card's cursor; then `items`' brackets
  // once it holds a card.
  const largest = {
    ...frame,
    omitted: omittedOf(closed, !page.includeRich),
    nextCursor: `${CURSOR_PREFIX}${kept.at(-1)?.key ?? 0}`,
  };
  let size = JSON.stringify(largest, null, 2).length + 4;
  const items: ListedItem[] = [];
  let at = kept.findIndex((i) => i.key > page.after);
  if (at < 0) at = kept.length;
  for (; at < kept.length && items.length < page.limit; at++) {
    cardRich = false;
    const card = lister(kept[at]!);
    const cost = cardCost(card);
    // The first card of a page is listed whatever its size, so paging always ends.
    if (items.length > 0 && size + cost > LIST_ITEMS_BUDGET) break;
    size += cost;
    items.push(card);
    richLeftOut ||= cardRich;
  }
  const omitted = omittedOf(closed, richLeftOut);
  return {
    ...frame,
    count: items.length,
    items,
    ...(omitted ? { omitted } : {}),
    ...(at < kept.length ? { nextCursor: `${CURSOR_PREFIX}${kept[at - 1]!.key}` } : {}),
  };
}
