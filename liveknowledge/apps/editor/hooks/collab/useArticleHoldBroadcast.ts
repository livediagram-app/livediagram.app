'use client';

// Our paragraph hold, to the room (docs/specs/007-editor/article-pages.md "Holding a paragraph"): a new claim goes
// through `sequence`, so we learn the room's answer (a collaborator's hold on the spot, sent first, means it went to
// them); the same claim is said again while we type; a release once we let go. Same gate as the caret: only while
// the room is open, and closed every claim is ours at once. Also tells the holds store which tab we are on.

import { useEffect, useEffectEvent, type RefObject } from 'react';
import type { RoomOp, RoomOutgoing } from '@liveknowledge/api-schema';
import {
  answerArticleClaim,
  getLocalArticleHold,
  releaseArticleHold,
  setArticleHoldsLive,
  setArticleHoldsTab,
  subscribeLocalArticleHold,
  type LocalHoldChange,
} from '@/lib/article/article-holds-store';

type HoldRoom = {
  send: (msg: RoomOutgoing) => void;
  sequence?: (op: RoomOp) => Promise<boolean>;
};

export function useArticleHoldBroadcast(deps: {
  roomRef: RefObject<HoldRoom | null>;
  // The room is open for this document (hydrated, and server-stored).
  live: boolean;
  activeId: string;
}): void {
  const room = useEffectEvent(() => deps.roomRef.current);
  const { live, activeId } = deps;

  useEffect(() => {
    setArticleHoldsTab(activeId);
  }, [activeId]);

  useEffect(() => {
    setArticleHoldsLive(live);
    if (!live) return;
    // Whether the room heard a claim from us since our last release: only then is a release worth sending.
    let said = false;
    const onChange = (change: LocalHoldChange) => {
      const hold = getLocalArticleHold();
      if (change === 'release' || !hold) {
        if (said)
          room()?.send({ kind: 'op', op: { kind: 'article-hold', tabId: activeId, flow: null } });
        said = false;
        return;
      }
      const op: RoomOp = { kind: 'article-hold', tabId: activeId, flow: hold.flow, ...hold.spot };
      said = true;
      const r = room();
      if (change === 'refresh') {
        r?.send({ kind: 'op', op });
        return;
      }
      if (!r?.sequence) {
        r?.send({ kind: 'op', op });
        answerArticleClaim(hold.seq, false);
        return;
      }
      void r.sequence(op).then((confirmed) => answerArticleClaim(hold.seq, confirmed));
    };
    const unsubscribe = subscribeLocalArticleHold(onChange);
    return () => {
      unsubscribe();
      // Leaving the tab, or the room closing: our hold goes, and the room hears it while it can.
      if (said)
        room()?.send({ kind: 'op', op: { kind: 'article-hold', tabId: activeId, flow: null } });
      releaseArticleHold();
      setArticleHoldsLive(false);
    };
  }, [live, activeId]);
}
