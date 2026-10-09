// Leaving Illustrate on a tab with articles (docs/specs/007-editor/article-pages.md "Leaving
// Illustrate"): Diagram and Draw draw no pages and no writing, so an editor's switch away asks
// first. Convert turns every article into Page elements (measured from the writing as laid out
// now) in the same tab edit as the switch; Keep switches with the articles left as they are, for Illustrate;
// Cancel stays. A tab with content but no articles asks a lighter question, a confirmation beside
// the mode switch (docs/specs/007-editor/editor-modes.md "Leaving Illustrate"): its pages do not
// show in Diagram or Draw, so what is on them may not look the same; Switch or Cancel. A visitor, a
// locked tab or an empty tab switches straight away.
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
  // The mode asked for while the articles question is open.
  pending: EditorMode | null;
  // The mode asked for while the lighter confirmation is open (pages, no articles).
  confirming: EditorMode | null;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
  convert: () => void;
  keep: () => void;
  cancel: () => void;
};

export function useLeaveIllustrate<
  M extends { mode: EditorMode; setMode: (m: EditorMode, alsoChange?: (t: Tab) => Tab) => void },
>(
  editorMode: M,
  deps: { tab: Tab | undefined; canEdit: boolean },
): { editorMode: M; leave: LeaveIllustrate } {
  const { tab, canEdit } = deps;
  const [pending, setPending] = useState<EditorMode | null>(null);
  const [confirming, setConfirming] = useState<EditorMode | null>(null);
  const { mode, setMode: rawSet } = editorMode;
  const setMode = useCallback(
    (next: EditorMode) => {
      const leaving =
        mode === 'illustrate' && next !== 'illustrate' && canEdit && !!tab && tab.locked !== true;
      if (leaving && Object.keys(articlesOf(tab)).length > 0) setPending(next);
      else if (leaving && tab.elements.length > 0) setConfirming(next);
      else rawSet(next);
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
    // The articles turned into pages and the switch are one tab edit: one undo puts the tab back in
    // Illustrate with its articles (docs/specs/007-editor/editor-modes.md "Where the mode lives").
    rawSet(pending, (t) => {
      let next = t;
      for (const [flow, blocks] of typed) {
        const doc = articlesOf(next)[flow];
        if (doc)
          next = withArticleFlow(next, flow, doc.style ? { blocks, style: doc.style } : { blocks });
      }
      return withArticlesAsPages(next, splits);
    });
    debugLog('[article] articles turned into pages', { tabId: tab.id, articles: splits.size });
    setPending(null);
  };
  const keep = () => {
    if (pending) rawSet(pending);
    setPending(null);
  };
  const cancel = () => setPending(null);
  const confirmSwitch = () => {
    if (confirming) {
      track('Editor', 'Changed', 'LeaveIllustrateConfirmed');
      rawSet(confirming);
    }
    setConfirming(null);
  };
  const cancelSwitch = () => setConfirming(null);
  return {
    editorMode: { ...editorMode, setMode },
    leave: { pending, convert, keep, cancel, confirming, confirmSwitch, cancelSwitch },
  };
}
