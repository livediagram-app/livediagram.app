// The page's name follows its Title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name"): typing in the
// Title renames the page, once, when the typing stops (the tree shows each key at once, live-page-title.ts). Only a title this editor wrote renames it: a
// title that changes with no local edit (a peer typing, the page's writing loading) is that peer's to follow, so
// opening a page never writes. A rename still waiting when the person moves to another page is made at once.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Tab } from '@liveknowledge/document';
import { pageTitleOf } from '@liveknowledge/document';
import { clearLivePageTitle } from '@/lib/article/live-page-title';

/**
 * How long a new Title rests before the page takes its name. Short on purpose: the Title only changes when the
 * writing commits, which already waits for the typing to pause (ArticleEditor's ARTICLE_IDLE_COMMIT_MS), and the
 * autosave waits 600 ms more after the last change. Inside that wait the name rides the same save as the Title; at
 * 600 ms it came after it, so a page closed in between kept its Title and lost its name ("Untitled Page" in the
 * tree over a page titled Notes, until the Title was typed in again).
 */
export const PAGE_NAME_SETTLE_MS = 50;

export function usePageNameFromTitle({
  activeTab,
  canEdit,
  localEditSeq,
  rename,
}: {
  activeTab: Tab;
  // An Editor of the knowledgebase's pages; nobody else's typing renames anything.
  canEdit: boolean;
  // Bumped by every edit made in this editor (useEditorDocument).
  localEditSeq: RefObject<number>;
  rename: (tabId: string, title: string) => void;
}): void {
  const tabId = activeTab.id;
  const title = pageTitleOf(activeTab);
  const latest = useRef(rename);
  useEffect(() => {
    latest.current = rename;
  });
  const seen = useRef<{ tabId: string; title: string; seq: number } | null>(null);
  const pending = useRef<{
    tabId: string;
    title: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    const flush = () => {
      const waiting = pending.current;
      if (!waiting) return;
      pending.current = null;
      clearTimeout(waiting.timer);
      latest.current(waiting.tabId, waiting.title);
    };
    const before = seen.current;
    const seq = localEditSeq.current ?? 0;
    seen.current = { tabId, title, seq };
    // Another page: what was typed on the last one names it now.
    if (pending.current && pending.current.tabId !== tabId) flush();
    if (!canEdit || !before || before.tabId !== tabId || before.title === title) return;
    // No edit was made here since the title was last read: it changed from elsewhere.
    if (seq === before.seq) return;
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { tabId, title, timer: setTimeout(flush, PAGE_NAME_SETTLE_MS) };
  }, [tabId, title, canEdit, localEditSeq]);

  // Another page opened, or the editor closed: the tree's live title was the last page's (live-page-title.ts). Before
  // paint, so the new page's row never shows the last one's title.
  useLayoutEffect(() => {
    clearLivePageTitle();
    return clearLivePageTitle;
  }, [tabId]);

  // Leaving the editor with a rename still waiting: nothing is left to save it, so it is dropped.
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer);
    },
    [],
  );
}
