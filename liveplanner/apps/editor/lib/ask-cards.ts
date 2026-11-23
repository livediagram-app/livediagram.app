// The plan's cards as Ask AI reads them (docs/specs/026-plan/ask-ai.md; liveworkspace/docs/specs/019-ask/ask.md "In
// each app"): a passage per card that is neither archived nor trashed, holding its number, title, description and
// status, on the tab whose board shows it (the first tab for a card no board shows, so it can still be opened). Pure,
// and linear in the cards: read when a question is asked, never on load.
import {
  cardRefOrKey,
  isArchived,
  isTrashed,
  itemStatus,
  itemTitle,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { AskPassage } from '@liveworkspace/ask';

/** A card's passage id begins with this: what tells a card's source from an element's. */
export const CARD_PASSAGE_PREFIX = 'card:';

export const isCardSource = (source: Pick<AskPassage, 'id'>): boolean =>
  source.id.startsWith(CARD_PASSAGE_PREFIX);

export function cardPassages(input: {
  items: ReadonlyMap<string, Item> | undefined;
  types?: readonly ItemTypeDef[] | undefined;
  tabOf: (item: Item) => { id: string; name: string } | null;
  // Where a card no board shows is said to be.
  fallback: { id: string; name: string } | undefined;
}): AskPassage[] {
  const { items, types, tabOf, fallback } = input;
  if (!items) return [];
  const out: AskPassage[] = [];
  for (const item of items.values()) {
    if (isArchived(item) || isTrashed(item)) continue;
    const tab = tabOf(item) ?? fallback;
    if (!tab) continue;
    const title = itemTitle(item).trim();
    const description = item.fields['description'];
    const status = itemStatus(item);
    const ref = cardRefOrKey(item, types);
    const text = [
      `${ref} ${title}`.trim(),
      typeof description === 'string' ? description.trim() : '',
      status ? `Status: ${status}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    out.push({
      id: `${CARD_PASSAGE_PREFIX}${item.id}`,
      tabId: tab.id,
      tabName: tab.name,
      elementId: item.id,
      kind: 'Card',
      title: title ? `${ref} ${title}` : ref,
      text,
    });
  }
  return out;
}
