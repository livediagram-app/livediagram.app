// A request to open a page's panel on a tab, or to close it, from outside IllustratePages
// (docs/specs/007-editor/illustrate-tour.md "Code"): the Illustrate tour, mounted beside the canvas, opens the
// tour page's panel on the tab a step is about. IllustratePages owns the panel and follows each new request once.
import { useState, useSyncExternalStore } from 'react';
import type { PagePanelTab } from '@/components/canvas/IllustratePagePanel';
import { createListeners } from '@/lib/listeners';

type PagePanelRequest = {
  seq: number;
  // The page whose panel opens; null closes whichever panel is open.
  pageId: string | null;
  tab: PagePanelTab;
};

let request: PagePanelRequest = { seq: 0, pageId: null, tab: 'page' };
const listeners = createListeners();

export function requestPagePanel(pageId: string | null, tab: PagePanelTab = 'page'): void {
  request = { seq: request.seq + 1, pageId, tab };
  listeners.notify();
}

function usePagePanelRequest(): PagePanelRequest {
  return useSyncExternalStore(
    listeners.subscribe,
    () => request,
    () => request,
  );
}

// IllustratePages' side: each new request opens that page's panel on its tab, afresh (a new `seq`), or closes it.
// Followed during render, as the article's Style request is, so the panel opens in the same commit.
export function useFollowPagePanelRequests(
  setOpened: (opened: { id: string; tab: PagePanelTab; seq: number } | null) => void,
): void {
  const current = usePagePanelRequest();
  const [seen, setSeen] = useState(current.seq);
  if (current.seq === seen) return;
  setSeen(current.seq);
  setOpened(current.pageId ? { id: current.pageId, tab: current.tab, seq: current.seq } : null);
}
