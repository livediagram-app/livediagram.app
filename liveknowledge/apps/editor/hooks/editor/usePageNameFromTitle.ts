// The page's name follows its Title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"):
// typing in the Title renames the page, once, when the typing stops. Only a title this editor wrote renames it: a
// title that changes with no local edit (a peer typing, the page's writing loading) is that peer's to follow, so
// opening a page never writes. A rename still waiting when the person moves to another page is made at once.
import { useEffect, useRef, type RefObject } from 'react';
import type { Tab } from '@liveknowledge/document';
import { pageTitleOf } from '@/lib/article/page-title';

/** How long the Title rests before the page takes its name: the autosave's own pause. */
export const PAGE_NAME_SETTLE_MS = 600;

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

  // Leaving the editor with a rename still waiting: nothing is left to save it, so it is dropped.
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer);
    },
    [],
  );
}
