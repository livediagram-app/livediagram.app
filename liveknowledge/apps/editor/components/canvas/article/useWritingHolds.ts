'use client';

// The writing's side of paragraph holds (docs/specs/007-editor/article-pages.md "Holding a paragraph"):
// collaborators' holds in this article brought into the view (outlined, and typing refused, by the holds plugin),
// and the room's answers to our claims: given, what was held back commits; given to someone else, the block goes
// back to how it was, with a notice naming them.
import { useEffect, useEffectEvent, useLayoutEffect, type RefObject } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { ArticleFlow } from '@liveknowledge/document';
import { docToBlocks } from '@/lib/article/article-convert';
import { heldBackBlocks } from '@/lib/article/article-hold-commit';
import { announceArticleHeld } from '@/lib/article/article-hold-notice';
import { setArticleHolds } from '@/lib/article/article-holds';
import {
  subscribeArticleHoldAnswers,
  useArticleHolds,
  type ArticleHoldAnswer,
} from '@/lib/article/article-holds-store';
import { replaceContent } from './article-editor-parts';

export function useWritingHolds(deps: {
  flow: string;
  viewRef: RefObject<EditorView | null>;
  committed: RefObject<ArticleFlow>;
  scheduleCommit: () => void;
}): void {
  const { flow, viewRef } = deps;
  const holds = useArticleHolds(flow);
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(setArticleHolds(view.state, holds));
  }, [holds, viewRef]);

  const onAnswer = useEffectEvent((answer: ArticleHoldAnswer) => {
    const view = viewRef.current;
    if (answer.flow !== flow || !view) return;
    if (answer.granted) {
      deps.scheduleCommit();
      return;
    }
    const base = deps.committed.current.blocks;
    const blocks = docToBlocks(view.state.doc, base);
    const back = heldBackBlocks(blocks, base, answer.spot.blockId);
    if (back !== blocks) replaceContent(view, back, false);
    announceArticleHeld(answer.holder);
  });
  useEffect(() => subscribeArticleHoldAnswers((answer) => onAnswer(answer)), []);
}
