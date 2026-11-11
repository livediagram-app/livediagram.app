// A page or a card split from the page panel (docs/specs/007-editor/pages-mode.md "Split Into Pages",
// docs/specs/007-editor/flashcards.md "Never flows"), each one tab edit. Split out of page-edits.ts, which
// spreads these into pageEdits.
import {
  articlesOf,
  canSplitFlashcardAt,
  MAX_PAGES,
  nextArticleFlowId,
  nextPageId,
  pagesOf,
  withFlashcardSplit,
  withPageSplit,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { cardOverflowNow } from '@/lib/flashcard-overflow-store';

export type CardSplitState = 'fits' | 'ready' | 'one-paragraph' | 'page-limit';

export function pageSplitEdits({
  tabId,
  tab,
  current,
  commitTab,
  onGoTo,
  toastInfo,
  takesEdits,
  refusedLocked,
  page,
}: {
  tabId: string;
  tab: Tab;
  current: readonly Page[];
  commitTab: (change: (tab: Tab) => Tab | null) => void;
  onGoTo: (pageId: string) => void;
  toastInfo: (message: string) => void;
  takesEdits: () => boolean;
  refusedLocked: (pageId: string, edit: string) => boolean;
  page: (pageId: string) => Page | undefined;
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

  const cardSplitState = (pageId: string): CardSplitState => {
    const card = page(pageId);
    const from = card?.flow ? cardOverflowNow(card.flow) : null;
    const doc = card?.flow ? articlesOf(tab)[card.flow] : undefined;
    if (!from || !doc) return 'fits';
    if (!canSplitFlashcardAt(doc, from)) return 'one-paragraph';
    return current.length >= MAX_PAGES ? 'page-limit' : 'ready';
  };
  // The card's writing past its foot onto a new card after it, one edit; the view flips to it.
  const splitCard = (pageId: string) => {
    if (!takesEdits() || refusedLocked(pageId, 'split')) return;
    const card = page(pageId);
    const from = card?.flow ? cardOverflowNow(card.flow) : null;
    if (!card || !from) return;
    const id = nextPageId(current);
    const flow = nextArticleFlowId(new Set(current.flatMap((p) => (p.flow ? [p.flow] : []))));
    const out = withFlashcardSplit(tab, pageId, from, id, flow);
    if ('refused' in out) {
      if (out.refused === 'page_limit')
        toastInfo(`A tab holds at most ${MAX_PAGES} pages: delete one to split this card.`);
      debugLog('[flashcard] split refused', { tabId, pageId, reason: out.refused });
      return;
    }
    track('Tab', 'Changed', 'FlashcardSplit');
    commitTab((t) => {
      if (t === tab) return out.tab;
      const again = withFlashcardSplit(t, pageId, from, id, flow);
      return 'tab' in again ? again.tab : null;
    });
    onGoTo(id);
    debugLog('[flashcard] split', { tabId, pageId, from });
  };
  return { splitPage, cardSplitState, splitCard };
}
