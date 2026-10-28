// An Inbox row's place as the editors' deep link reads it (liveplanner's lib/collab-deep-link.ts): `#t=<tab>&el=<element>`,
// `&open=action|comments` for the popover to open there, and `&item=<card>` for a card to open (alone, `#item=<card>`,
// for a card no board shows), with `&thread=<thread>` for one of its comment threads. Hosts append it to an item's address in their `itemHref`.

import type { ItemPlace } from './types';

export function placeHash(at?: ItemPlace): string {
  const hash = new URLSearchParams();
  if (at?.tabId) hash.set('t', at.tabId);
  if (at?.tabId && at.elementId) hash.set('el', at.elementId);
  if (at?.tabId && at.elementId && at.open) hash.set('open', at.open);
  if (at?.cardId) hash.set('item', at.cardId);
  if (at?.cardId && at.threadId) hash.set('thread', at.threadId);
  const text = hash.toString();
  return text ? `#${text}` : '';
}
