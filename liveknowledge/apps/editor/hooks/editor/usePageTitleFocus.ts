import { useEffect } from 'react';
import type { Tab } from '@liveknowledge/document';
import { pageFlowOf } from '@/lib/article/page-title';
import { takeTitleFocus } from '@/lib/page-title-focus';

// A page made here opens with the caret in its Title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A
// knowledgebase", "Add"). The makers ask (lib/page-title-focus.ts); this answers once the page is the open one, its
// writing is held and may be written in, by asking the article for the caret (useArticles requestFocus), which the
// page's editor takes as it mounts. Without it the button pressed kept the focus and the first keys went to the canvas.
export function usePageTitleFocus(deps: {
  activeTab: Tab;
  // Whether this session may write on the page: a reader's page takes no caret.
  editable: boolean;
  // Puts the caret at the end of the Title of the article `flow`; null while the articles are not up.
  focusTitle: ((flow: string) => void) | null;
}) {
  const { activeTab, editable, focusTitle } = deps;
  const flow = pageFlowOf(activeTab);
  const ready = editable && !!focusTitle && !!flow && activeTab.locked !== true;
  useEffect(() => {
    if (!ready || !flow || !focusTitle) return;
    if (takeTitleFocus(activeTab.id)) focusTitle(flow);
    // oxlint-disable-next-line react/exhaustive-deps -- once per page opened and made ready, not per render
  }, [activeTab.id, flow, ready]);
}
