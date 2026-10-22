'use client';

// The deck follows the slide pages (docs/specs/007-editor/pages-mode.md "Slides"): every slide page is in the
// deck, a tab's page slides in its page order, whoever made or moved the pages (a template, Add Page, a reorder, a
// peer, an agent, an undo). One pass whenever the pages change, never on an element edit.

import { useEffect, useEffectEvent, useMemo } from 'react';
import { deckPagesKey, pageMovedTo, type Tab } from '@livedocuments/document';

// Called after the stored deck's own hydration effect, so a deck that arrives with the document is what the pass
// builds on: an earlier pass over the empty deck would have saved its page slides alone over the stored deck.
export function useDeckFollowsPages({
  tabs,
  ready,
  hasStoredDeck,
  documentId,
  followPages,
}: {
  tabs: readonly Tab[];
  // The document has loaded (its stored deck with it).
  ready: boolean;
  hasStoredDeck: boolean;
  documentId: string | null | undefined;
  followPages: () => void;
}): void {
  const pages = useMemo(() => deckPagesKey(tabs), [tabs]);
  const follow = useEffectEvent(() => {
    if (ready) followPages();
  });
  useEffect(() => {
    follow();
  }, [ready, pages, hasStoredDeck, documentId]);
}

// The tabs with one tab's page moved to a unit index (pageMovedTo), for a page slide dragged in the deck. The same
// tabs when the move is refused (an unknown page).
export function tabsWithPageMoved(
  tabs: Tab[],
  tabId: string,
  pageId: string,
  unitIndex: number,
): Tab[] {
  return tabs.map((t) => {
    if (t.id !== tabId) return t;
    const out = pageMovedTo(t, pageId, unitIndex);
    return 'tab' in out ? out.tab : t;
  });
}
