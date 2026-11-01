// The editor's element deep link (docs/specs/013-workspace/inbox.md §1): the URL fragment an
// Inbox row opens a document with, and the parser the editor reads it
// back with.
//
//   /document/<id>[?s=<code>]#t=<tabId>&el=<elementId>&open=action|comments
//
// `t` is the tab pin the editor already writes on every tab switch
// (docs/specs/006-document/per-tab-storage.md, useTabEntryEffects); `el` and `open` ride beside it and are
// consumed once on load. Pure functions, shared by the Explorer (which
// builds the link) and the editor (which reads it), so the two halves
// cannot drift on the parameter names.

import type { ActivityPlace } from '@livediagram/api-schema';

export type CollabPopover = 'action' | 'comments';

// `at` is the element to arrive at.
export type CollabDeepLink = {
  at: { tabId: string; elementId: string };
  open: CollabPopover | null;
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
