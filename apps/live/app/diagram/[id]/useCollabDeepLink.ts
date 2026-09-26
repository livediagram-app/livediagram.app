'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Element } from '@livediagram/diagram';
import { parseCollabDeepLink, type CollabDeepLink } from '@/lib/collab-deep-link';
import type { TabLoadState } from './editor-page-helpers';

// Consumes the element deep link an Activity row opens the editor with
// (docs/specs/013-workspace/activity-page.md §1): `#t=<tab>&el=<element>&open=action|comments`. Once the
// pinned tab's elements have loaded, select the element, bring it into
// view, and open the named popover — exactly what a Collaborate Panel
// row click does in-editor.
//
// Two hooks because of WHEN the fragment can be read. useTabEntryEffects
// rewrites the hash to the plain `#t=` pin on the hydration commit, so
// the link has to be captured before that effect runs — which means an
// effect declared EARLIER in useEditorState (effects run in declaration
// order). And it cannot be read during the first render either: on a
// client-side navigation from the Explorer, Next commits the new URL
// after the page's first render, so the hash still belongs to the
// previous page then. So `useCollabDeepLinkCapture` re-reads the hash
// on every commit until it finds a link (a rewritten plain pin parses
// to null and never overwrites a capture), and `useCollabDeepLink`
// consumes it once the tab is ready. Held in a ref: nothing re-renders
// on it. Consumed once, so a refresh lands on the tab without
// re-opening the popover.
export function useCollabDeepLinkCapture(): MutableRefObject<CollabDeepLink | null> {
  const link = useRef<CollabDeepLink | null>(null);
  useEffect(() => {
    if (link.current || typeof window === 'undefined') return;
    const parsed = parseCollabDeepLink(window.location.hash);
    if (parsed) link.current = parsed;
  });
  return link;
}

export function useCollabDeepLink({
  link,
  hydrated,
  activeId,
  activeTabLoadState,
  elements,
  select,
  scrollIntoView,
  openActionPopover,
  openComments,
}: {
  link: MutableRefObject<CollabDeepLink | null>;
  hydrated: boolean;
  activeId: string | null;
  activeTabLoadState: TabLoadState;
  elements: Element[];
  select: (elementId: string) => void;
  scrollIntoView: (x: number, y: number, w: number, h: number, opts?: { center?: boolean }) => void;
  openActionPopover: (elementId: string) => void;
  openComments: (elementId: string) => void;
}) {
  const consumed = useRef(false);

  useEffect(() => {
    const target = link.current;
    if (!target || consumed.current || !hydrated || activeId !== target.tabId) return;
    if (activeTabLoadState === 'loading') return;
    // Either the tab loaded (find the element) or it errored (nothing to
    // find); both consume the link so it can't fire on a later tab.
    consumed.current = true;
    if (activeTabLoadState !== 'ready') return;
    const el = elements.find((e) => e.id === target.elementId);
    // Deleted since the Activity page loaded: the tab is open, which is
    // as close as the link can get (docs/specs/013-workspace/activity-page.md §1).
    if (!el || el.type === 'arrow') return;
    select(el.id);
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    if (target.open === 'action') openActionPopover(el.id);
    else if (target.open === 'comments') openComments(el.id);
    // The setters are stable editor callbacks; re-running on their
    // identity would only re-evaluate an already-consumed link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, hydrated, activeId, activeTabLoadState, elements]);
}
