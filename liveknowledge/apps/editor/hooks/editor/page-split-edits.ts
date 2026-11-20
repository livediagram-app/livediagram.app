// A page split from the page panel (docs/specs/007-editor/pages-mode.md "Split Into Pages"), one tab edit. Split out of page-edits.ts, which
// spreads these into pageEdits.
import { MAX_PAGES, pagesOf, withPageSplit, type Page, type Tab } from '@liveknowledge/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';

export function pageSplitEdits({
  tabId,
  tab,
  current,
  commitTab,
  onGoTo,
  toastInfo,
  takesEdits,
  refusedLocked,
}: {
  tabId: string;
  tab: Tab;
  current: readonly Page[];
  commitTab: (change: (tab: Tab) => Tab | null) => void;
  onGoTo: (pageId: string) => void;
  toastInfo: (message: string) => void;
  takesEdits: () => boolean;
  refusedLocked: (pageId: string, edit: string) => boolean;
}) {
  // One page per cluster of the page's content, each cluster at its own size; the view goes to the
  // first. One tab edit.
  const splitPage = (pageId: string) => {
    if (!takesEdits() || refusedLocked(pageId, 'split')) return;
    // At the page limit a split has no room for a second page.
    if (current.length >= MAX_PAGES) {
      toastInfo(`A tab holds at most ${MAX_PAGES} pages: delete one to split this page.`);
      debugLog('[page] split refused: page limit', { tabId, pageId });
      return;
    }
    // Read from the tab as it is, as Duplicate reads its copy's id.
    const before = pagesOf(tab);
    const split = withPageSplit(tab, pageId);
    const made = split ? split.pages.length - before.length + 1 : 0;
    const first = split?.pages[before.findIndex((p) => p.id === pageId)]?.id;
    // The split names its new pages afresh each time, so the one read is the one stored (unless the tab moved on).
    if (made > 0) commitTab((t) => (t === tab ? split : withPageSplit(t, pageId)));
    if (made === 0) {
      toastInfo('This page is one group: nothing to split.');
      debugLog('[page] split: one group', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', 'PagesLaidOut');
    toastInfo(`Split into ${made} pages. Undo puts it back.`);
    if (first) onGoTo(first);
    debugLog('[page] page split', { tabId, pageId, pages: made });
  };

  return { splitPage };
}
