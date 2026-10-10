// The Cards panel's search (docs/specs/026-plan/items.md "Finding a card"): the document's cards that are
// neither archived nor trashed, of every card type the catalogue has (custom ones included) and of none,
// matched on number, title, description and type name, newest change first. "Not on a board" narrows them to
// the cards no board shows: whose status no column of the document's boards holds, or whose type every board
// naming that status leaves out (its Card Types); a set of card types narrows them to those types.
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

// `typeLabel`, when given, names the card's type ("Person"), so a search for a type's name finds its cards.
export function cardMatches(item: Item, query: string, typeLabel?: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  if (String(item.key) === q) return true;
  if (typeLabel && typeLabel.toLowerCase().includes(q)) return true;
  return haystackOf(item).includes(q);
}

// The statuses the document's boards name, each with the card types those boards show under it: 'all' when
// any board naming it shows every type, else the union of their Card Types (an empty set shows none).
export type BoardStatusTypes = ReadonlyMap<string, 'all' | ReadonlySet<string>>;

// A card is on a board when a board names its status as a column AND shows its type.
export function isOffBoard(item: Item, boardStatuses: BoardStatusTypes): boolean {
  const status = itemStatus(item);
  if (!status) return true;
  const shown = boardStatuses.get(status);
  if (shown === undefined) return true;
  return shown !== 'all' && !shown.has(item.type);
}

export function findCards(
  items: Iterable<Item>,
  opts: {
    query: string;
    show: CardFinderShow;
    boardStatuses: BoardStatusTypes;
    // Only cards of these types; absent or empty is every type.
    types?: ReadonlySet<string>;
    // A card type's name by its id, so the query matches it.
    typeLabel?: (typeId: string) => string;
  },
): Item[] {
  const out: Item[] = [];
  const byType = opts.types && opts.types.size > 0 ? opts.types : null;
  for (const it of items) {
    if (isTrashed(it) || isArchived(it)) continue;
    if (byType && !byType.has(it.type)) continue;
    if (opts.show === 'off-board' && !isOffBoard(it, opts.boardStatuses)) continue;
    if (cardMatches(it, opts.query, opts.typeLabel?.(it.type))) out.push(it);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
