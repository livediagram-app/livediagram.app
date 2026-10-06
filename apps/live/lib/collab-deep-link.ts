// The editor's element deep link (docs/specs/013-workspace/activity-page.md §1): the URL fragment an
// Activity row opens a document with, and the parser the editor reads it
// back with.
//
//   /document/<id>[?s=<code>]#t=<tabId>&el=<elementId>&open=action|comments
//   /document/<id>[?s=<code>]#t=<tabId>&el=<boardId>&item=<itemId>   (a Plan card, §2.4)
//   /document/<id>[?s=<code>]#item=<itemId>                           (a card no board shows)
//
// `t` is the tab pin the editor already writes on every tab switch
// (docs/specs/006-document/per-tab-storage.md, useTabEntryEffects); `el` and `open` ride beside it and are
// consumed once on load. Pure functions, shared by the Explorer (which
// builds the link) and the editor (which reads it), so the two halves
// cannot drift on the parameter names.

import type { ActivityCard, ActivityPlace } from '@livediagram/api-schema';

export type CollabPopover = 'action' | 'comments';

// `at` is the element to arrive at; null only for a card no board shows, which opens on the document's
// usual tab. `itemId` is the Plan card to open in the item panel.
export type CollabDeepLink = {
  at: { tabId: string; elementId: string } | null;
  open: CollabPopover | null;
  itemId: string | null;
};

type Reachable = Pick<ActivityPlace, 'documentId' | 'via' | 'shareCode'>;

function documentHref(doc: Reachable, hash: string): string {
  const query =
    doc.via === 'shared' && doc.shareCode ? `?s=${encodeURIComponent(doc.shareCode)}` : '';
  return `/document/${encodeURIComponent(doc.documentId)}${query}#${hash}`;
}

const pin = (tabId: string, elementId: string) =>
  `t=${encodeURIComponent(tabId)}&el=${encodeURIComponent(elementId)}`;

export function collabDeepLinkHref(place: ActivityPlace, open: CollabPopover): string {
  return documentHref(place, `${pin(place.tabId, place.elementId)}&open=${open}`);
}

// A Plan card's row (docs/specs/013-workspace/activity-page.md §1, §2.5): the board it is on, and the card.
export function cardDeepLinkHref(
  card: Pick<ActivityCard, 'id' | 'board' | 'documentId' | 'via' | 'shareCode'>,
): string {
  const item = `item=${encodeURIComponent(card.id)}`;
  return documentHref(
    card,
    card.board ? `${pin(card.board.tabId, card.board.elementId)}&${item}` : item,
  );
}

// Null unless the fragment names a tab AND an element, or a card: a plain
// `#t=` pin is the ordinary refresh case and is not a deep link. An
// unknown `open` value still selects the element, it just opens no
// popover, so a typo degrades to "show me the element".
export function parseCollabDeepLink(hash: string): CollabDeepLink | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const tabId = params.get('t');
  const elementId = params.get('el');
  const itemId = params.get('item') || null;
  const at = tabId && elementId ? { tabId, elementId } : null;
  if (!at && !itemId) return null;
  const open = params.get('open');
  return {
    at,
    open: open === 'action' || open === 'comments' ? open : null,
    itemId,
  };
}
