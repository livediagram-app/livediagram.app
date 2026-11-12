'use client';

import { useEffect, useRef, type MutableRefObject, useEffectEvent } from 'react';
import type { Element } from '@livehuddle/document';
import { parseCollabDeepLink, type CollabDeepLink } from '@/lib/collab-deep-link';
import type { TabLoadState } from './editor-page-helpers';

// Consumes an element deep link (docs/specs/013-workspace/inbox.md §1): `#t=<tab>&el=<element>`, from an old email
// or Inbox row. Once the pinned tab's elements have loaded, select the element and bring it into view. Its `open=`
// (action or comments) opens nothing: livehuddle has neither any more (docs/specs/002-project-scope/
// not-in-livehuddle.md "Comments, actions, links and notes").
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
// selecting the element again.
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
}: {
  link: MutableRefObject<CollabDeepLink | null>;
  hydrated: boolean;
  activeId: string | null;
  activeTabLoadState: TabLoadState;
  elements: Element[];
  select: (elementId: string) => void;
  scrollIntoView: (x: number, y: number, w: number, h: number, opts?: { center?: boolean }) => void;
}): void {
  const consumed = useRef(false);
  // The stable editor callbacks are read when the link lands, not depended on: re-running on their
  // identity would only re-evaluate an already-consumed link.
  const arriveAt = useEffectEvent(
    (el: { id: string; x: number; y: number; width: number; height: number }) => {
      select(el.id);
      scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    },
  );

  useEffect(() => {
    const target = link.current;
    if (!target || consumed.current || !hydrated) return;
    if (activeId !== target.at.tabId) return;
    if (activeTabLoadState === 'loading') return;
    // Either the tab loaded (find the element) or it errored (nothing to
    // find); both consume the link so it can't fire on a later tab.
    consumed.current = true;
    if (activeTabLoadState !== 'ready') return;
    const { elementId } = target.at;
    const el = elements.find((e) => e.id === elementId);
    // Deleted since the Inbox loaded: the tab is open, which is
    // as close as the link can get (docs/specs/013-workspace/inbox.md §1).
    if (!el || el.type === 'arrow') return;
    arriveAt(el);
  }, [link, hydrated, activeId, activeTabLoadState, elements]);
}
