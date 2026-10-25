// The editor's element deep link (docs/specs/013-workspace/inbox.md §1): the URL fragment an
// Inbox row opens a project with, and the parser the editor reads it
// back with.
//
//   /project/<id>[?s=<code>]#t=<tabId>&el=<elementId>&open=action|comments
//   /project/<id>[?s=<code>]#t=<tabId>&el=<boardId>&item=<itemId>   (a Plan card, §2.4)
//   /project/<id>[?s=<code>]#item=<itemId>                           (a card no board shows)
//
// `t` is the tab pin the editor already writes on every tab switch
// (docs/specs/006-project/per-tab-storage.md, useTabEntryEffects); `el` and `open` ride beside it and are
// consumed once on load. The shared Explorer builds the link; the editor reads it here.

export type CollabPopover = 'action' | 'comments';

// `at` is the element to arrive at; null only for a card no board shows, which opens on the project's
// usual tab. `itemId` is the Plan card to open in the item panel.
export type CollabDeepLink = {
  at: { tabId: string; elementId: string } | null;
  open: CollabPopover | null;
  itemId: string | null;
};

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
