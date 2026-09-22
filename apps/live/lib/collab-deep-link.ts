// The editor's element deep link (spec/142 §1): the URL fragment an
// Activity row opens a diagram with, and the parser the editor reads it
// back with.
//
//   /diagram/<id>[?s=<code>]#t=<tabId>&el=<elementId>&open=action|comments
//
// `t` is the tab pin the editor already writes on every tab switch
// (spec/13, useTabEntryEffects); `el` and `open` ride beside it and are
// consumed once on load. Pure functions, shared by the Explorer (which
// builds the link) and the editor (which reads it), so the two halves
// cannot drift on the parameter names.

import type { ActivityPlace } from '@livediagram/api-schema';

export type CollabPopover = 'action' | 'comments';

export type CollabDeepLink = {
  tabId: string;
  elementId: string;
  open: CollabPopover | null;
};

export function collabDeepLinkHref(place: ActivityPlace, open: CollabPopover): string {
  const query =
    place.via === 'shared' && place.shareCode ? `?s=${encodeURIComponent(place.shareCode)}` : '';
  const hash = `#t=${encodeURIComponent(place.tabId)}&el=${encodeURIComponent(place.elementId)}&open=${open}`;
  return `/diagram/${encodeURIComponent(place.diagramId)}${query}${hash}`;
}

// Null unless the fragment names BOTH a tab and an element: a plain
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
    tabId,
    elementId,
    open: open === 'action' || open === 'comments' ? open : null,
  };
}
