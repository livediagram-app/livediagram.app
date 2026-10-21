'use client';

// Where we are writing, live for collaborators (docs/specs/007-editor/article-pages.md
// "Collaboration"): while an article's writing has our caret, its place (block id, character offset)
// goes to the room as presence at the cursor's rate, the last place always following; when the
// writing loses the caret, a null that drops it. Same gates as the cursor: only while the room is
// open, and nothing while a hide-cursors vote runs (docs/specs/012-collaboration/session-tools.md),
// which retracts a caret already shown. Also tells the carets store which tab we are on, so only
// collaborators' carets on it are drawn.

import { useEffect, useEffectEvent, type RefObject } from 'react';
import type { RoomOp, RoomOutgoing } from '@livediagram/api-schema';
import {
  getLocalArticleCaret,
  setArticleCaretsTab,
  subscribeLocalArticleCaret,
} from '@/lib/article/article-carets-store';
import { BROADCAST_THROTTLE_MS } from './useEditorBroadcast';

export function useArticleCaretBroadcast(deps: {
  roomRef: RefObject<{ send: (msg: RoomOutgoing) => void } | null>;
  // The room is open for this document (hydrated, and shared or a team's).
  live: boolean;
  activeId: string;
  // A hide-cursors vote is open on the active tab.
  hidden: boolean;
}): void {
  const send = useEffectEvent((op: RoomOp) => {
    deps.roomRef.current?.send({ kind: 'op', op });
  });
  const { live, activeId, hidden } = deps;

  useEffect(() => {
    setArticleCaretsTab(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!live || hidden) return;
    let shown = false;
    let lastSent = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sendNow = () => {
      timer = null;
      const caret = getLocalArticleCaret();
      if (!caret) return;
      lastSent = Date.now();
      shown = true;
      send({ kind: 'article-caret', tabId: activeId, ...caret });
    };
    const onChange = () => {
      if (!getLocalArticleCaret()) {
        if (timer) clearTimeout(timer);
        timer = null;
        if (shown) send({ kind: 'article-caret', tabId: activeId, flow: null });
        shown = false;
        return;
      }
      if (timer) return;
      const wait = lastSent + BROADCAST_THROTTLE_MS - Date.now();
      if (wait <= 0) sendNow();
      else timer = setTimeout(sendNow, wait);
    };
    const unsubscribe = subscribeLocalArticleCaret(onChange);
    // Already writing (the vote closed, the tab came back): show it now.
    onChange();
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      if (shown) send({ kind: 'article-caret', tabId: activeId, flow: null });
    };
  }, [live, activeId, hidden]);
}
