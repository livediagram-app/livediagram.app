// The editor's element deep link (docs/specs/013-workspace/inbox.md §1): the URL fragment an old email or Inbox row
// opens a document with, and the parser the editor reads it back with.
//
//   /document/<id>[?s=<code>]#t=<tabId>&el=<elementId>[&open=action|comments]
//
// `t` is the tab pin the editor already writes on every tab switch
// (docs/specs/006-document/per-tab-storage.md, useTabEntryEffects); `el` and `open` ride beside it and are
// consumed once on load. Nothing in livehuddle builds one any more, and `open` opens nothing: comments and actions
// left it (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes").

export type CollabPopover = 'action' | 'comments';

// `at` is the element to arrive at.
export type CollabDeepLink = {
  at: { tabId: string; elementId: string };
  open: CollabPopover | null;
};

// Null unless the fragment names a tab AND an element: a plain
// `#t=` pin is the ordinary refresh case and is not a deep link. An
// unknown `open` value still selects the element, it just opens no
// popover, so a typo degrades to "show me the element".
export function parseCollabDeepLink(hash: string): CollabDeepLink | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const tabId = params.get('t');
  const elementId = params.get('el');
  if (!tabId || !elementId) return null;
  const open = params.get('open');
  return {
    at: { tabId, elementId },
    open: open === 'action' || open === 'comments' ? open : null,
  };
}
