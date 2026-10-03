// Leaving Illustrate on a tab with articles (docs/specs/007-editor/article-pages.md "Leaving
// Illustrate"): Diagram and Draw draw no pages and no writing, so an editor's switch away asks
// first. Convert turns every article into Page elements (one edit, measured from the writing as
// laid out now) and switches; Keep switches with the articles left as they are, for Illustrate;
// Cancel stays. A visitor, a locked tab or a tab with no articles switches straight away.
import { useCallback, useState } from 'react';
import {
  articlesOf,
  withArticleFlow,
  withArticlesAsPages,
  type ArticleBlock,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type LeaveIllustrate = {
  // The mode asked for while the question is open.
  pending: EditorMode | null;
  convert: () => void;
  keep: () => void;
  cancel: () => void;
};

export function useLeaveIllustrate<
  M extends { mode: EditorMode; setMode: (m: EditorMode) => void },
>(
  editorMode: M,
  deps: { tab: Tab | undefined; canEdit: boolean; commitTabs: (map: (ts: Tab[]) => Tab[]) => void },
): { editorMode: M; leave: LeaveIllustrate } {
  const { tab, canEdit, commitTabs } = deps;
  const [pending, setPending] = useState<EditorMode | null>(null);
  const { mode, setMode: rawSet } = editorMode;
  const setMode = useCallback(
    (next: EditorMode) => {
      const asks =
        mode === 'illustrate' &&
        next !== 'illustrate' &&
        canEdit &&
        !!tab &&
        tab.locked !== true &&
        Object.keys(articlesOf(tab)).length > 0;
      if (!asks) {
        rawSet(next);
        return;
      }
      setPending(next);
    },
    [mode, rawSet, canEdit, tab],
  );
  const convert = () => {
    if (!pending || !tab) return;
    const splits = new Map<string, string[][]>();
    const typed = new Map<string, ArticleBlock[]>();
    for (const flow of Object.keys(articlesOf(tab))) {
      const handle = articleHandleOf(flow);
      if (!handle) continue;
      // What is being typed goes into the pages too, in the same edit (one undo step).
      typed.set(flow, handle.takeBlocks());
      splits.set(flow, handle.blocksByPage());
    }
    track('Tab', 'Changed', 'ArticlesToPages');
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== tab.id) return t;
        let next = t;
        for (const [flow, blocks] of typed) {
          const doc = articlesOf(next)[flow];
          if (doc)
            next = withArticleFlow(
              next,
              flow,
              doc.style ? { blocks, style: doc.style } : { blocks },
            );
        }
        return withArticlesAsPages(next, splits);
      }),
    );
    debugLog('[article] articles turned into pages', { tabId: tab.id, articles: splits.size });
    rawSet(pending);
    setPending(null);
  };
  const keep = () => {
    if (pending) rawSet(pending);
    setPending(null);
  };
  const cancel = () => setPending(null);
  return { editorMode: { ...editorMode, setMode }, leave: { pending, convert, keep, cancel } };
}
