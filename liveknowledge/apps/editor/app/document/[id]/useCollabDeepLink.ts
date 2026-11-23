'use client';

import { useEffect, useRef, type MutableRefObject, useEffectEvent } from 'react';
import type { Element } from '@liveknowledge/document';
import { articleBlockRect } from '@/lib/article/article-editor-store';
import { parseCollabDeepLink, type CollabDeepLink } from '@/lib/collab-deep-link';
import type { TabLoadState } from './editor-page-helpers';

// Consumes the element deep link an Inbox row opens the editor with
// (docs/specs/013-workspace/inbox.md §1): `#t=<tab>&el=<element>&open=action|comments`. Once the
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
}): void {
  const consumed = useRef(false);
  // The stable editor callbacks are read when the link lands, not depended on: re-running on their
  // identity would only re-evaluate an already-consumed link.
  const arriveAt = useEffectEvent(
    (
      el: { id: string; x: number; y: number; width: number; height: number },
      open: string | null | undefined,
    ) => {
      select(el.id);
      scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
      if (open === 'action') openActionPopover(el.id);
      else if (open === 'comments') openComments(el.id);
    },
  );

  const arriveAtBlock = useEffectEvent((at: { x: number; y: number; w: number; h: number }) =>
    scrollIntoView(at.x, at.y, at.w, at.h, { center: true }),
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
    if (el) {
      if (el.type !== 'arrow') arriveAt(el, target.open);
      return;
    }
    // Not an element: a block of an article's writing, a sent paragraph's link
    // (docs/specs/013-workspace/send-to-plan.md), brought into view once its article lays it out
    // (a second at most, then the tab alone, as for a deleted element). The search ends itself: the
    // tab's elements settling meanwhile re-run this effect, and must not cut it short.
    let frames = 60;
    const seek = () => {
      const at = articleBlockRect(elementId);
      if (at) arriveAtBlock(at);
      else if (--frames > 0) requestAnimationFrame(seek);
    };
    seek();
  }, [link, hydrated, activeId, activeTabLoadState, elements]);
}
