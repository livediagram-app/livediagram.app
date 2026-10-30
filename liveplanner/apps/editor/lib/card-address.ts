// An open card's address (docs/specs/026-plan/plan-board.md "Its address"): the tab pin with the card beside it,
// `#t=<tab>&item=<card id>`, the same fragment an Inbox row opens a card with (lib/collab-deep-link.ts), so one
// grammar is read for both. The history entry an opened card added carries CARD_ENTRY_KEY, so closing the card
// steps back off it rather than leaving a second copy of the plan's address behind.
import { placeHash } from '@liveworkspace/explorer';

export const CARD_ENTRY_KEY = 'liveplannerCard';

// The fragment for a tab, with the open card when there is one.
export function cardHash(tabId: string, itemId: string | null): string {
  return placeHash({ tabId, cardId: itemId });
}

// The card a fragment names, or null.
export function hashCardId(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return raw ? new URLSearchParams(raw).get('item') || null : null;
}

// Whether a history entry is one an opened card added.
export function isCardEntry(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[CARD_ENTRY_KEY] === true
  );
}

// The state to write on an entry, keeping (or setting) the mark. The router adds its own keys beside it.
export function cardEntryState(card: boolean): Record<string, boolean> {
  return card ? { [CARD_ENTRY_KEY]: true } : {};
}

// Copy Card Link's address: the editor's own path for the plan, the share code it was opened with (so a person on the
// same share link can follow it), then the card's fragment. Any other query (an Explorer hand-off, `share=1`) stays
// behind.
export function cardLink(input: {
  origin: string;
  projectId: string;
  // The page's own query, for its share code.
  search: string;
  tabId: string;
  itemId: string;
}): string {
  const code = new URLSearchParams(input.search).get('s');
  const query = code ? `?s=${encodeURIComponent(code)}` : '';
  return `${input.origin}/project/${encodeURIComponent(input.projectId)}${query}${cardHash(input.tabId, input.itemId)}`;
}
