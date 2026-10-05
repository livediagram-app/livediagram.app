// The Cards panel's search (docs/specs/025-plan/items.md "Finding a card"): the document's cards that are
// neither archived nor trashed, matched on number, title and description, newest change first. "Not on a
// board" narrows them to the cards whose status no column of the tab's boards holds.
import { isArchived, isTrashed } from './board';
import { itemStatus, itemTitle, type Item } from './item';

export type CardFinderShow = 'all' | 'off-board';

// Each item's lowercased title and description, worked out once per item version: items are replaced,
// never changed, on a write, so a keystroke searches cached text instead of lowercasing every description
// again (up to ITEMS_MAX of up to ITEM_DESCRIPTION_MAX characters).
const haystacks = new WeakMap<Item, string>();
function haystackOf(item: Item): string {
  let hay = haystacks.get(item);
  if (hay === undefined) {
    const description = item.fields['description'];
    hay = `${itemTitle(item)}\n${typeof description === 'string' ? description : ''}`.toLowerCase();
    haystacks.set(item, hay);
  }
  return hay;
}

export function cardMatches(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  if (String(item.key) === q) return true;
  return haystackOf(item).includes(q);
}

export function isOffBoard(item: Item, boardStatuses: ReadonlySet<string>): boolean {
  const status = itemStatus(item);
  return !status || !boardStatuses.has(status);
}

export function findCards(
  items: Iterable<Item>,
  opts: { query: string; show: CardFinderShow; boardStatuses: ReadonlySet<string> },
): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (isTrashed(it) || isArchived(it)) continue;
    if (opts.show === 'off-board' && !isOffBoard(it, opts.boardStatuses)) continue;
    if (cardMatches(it, opts.query)) out.push(it);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
