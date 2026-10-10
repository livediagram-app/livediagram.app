import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ElementDelta, ShapeElement, Tab } from '@livediagram/document';
import type { connectRoom } from '@/lib/api-client';
import { applyDeltaToTabs, type PendingIdeaIds } from '@/app/document/[id]/room-op-apply';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';

// This browser's idea posts, from the press until the room answers them
// (docs/specs/012-collaboration/idea-box.md "Racing for the last card", blueprint idea-box-race.md).
//
// A post applies its card at once, with a fresh random id, and goes to the room through `sequence`, whose
// promise settles when the room's cursor answers it. Until then it is PENDING: a peer's card that reaches a full
// box meanwhile was numbered first, so `applyRoomOpToTabs` (given `pendingIdeaIds`) lets the newest pending
// card go for it. The check below sees that card leave and tells the poster, and the post's promise answers
// false, so the composer puts the draft back.

// What a post that lost the last card says (the Q&A board's refused note, in the box's words).
export const IDEA_BOX_FULL_MESSAGE = 'The box filled up before your idea landed.';

type IdeaPost = {
  tabId: string;
  elementId: string;
  round: string | undefined;
  // The card has been seen in the box: only a card that was there can be found gone.
  seen: boolean;
  resolve: (landed: boolean) => void;
};

export function useIdeaPosts(deps: {
  tabs: Tab[];
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  onRefused: (message: string) => void;
}): {
  post: (tabId: string, element: ShapeElement, text: string) => Promise<boolean>;
  pendingIdeaIds: PendingIdeaIds;
} {
  const { tabs, tickTabs, roomRef } = deps;
  const pending = useRef(new Map<string, IdeaPost>());
  const onRefused = useLatest(deps.onRefused);

  const settle = useCallback((id: string, landed: boolean) => {
    const post = pending.current.get(id);
    if (!post) return;
    pending.current.delete(id);
    post.resolve(landed);
  }, []);

  const post = useCallback(
    (tabId: string, element: ShapeElement, text: string) =>
      new Promise<boolean>((resolve) => {
        const id = crypto.randomUUID();
        const round = element.collabRound ?? undefined;
        const delta: ElementDelta = { kind: 'idea', text, id, ...(round ? { round } : {}) };
        pending.current.set(id, { tabId, elementId: element.id, round, seen: false, resolve });
        tickTabs((ts) => applyDeltaToTabs(ts, tabId, element.id, delta));
        const room = roomRef.current;
        // No live room, nobody to race: the card is in.
        if (!room) return settle(id, true);
        // Answered, or never reached the room (a dropped socket, no answer in time): either way it is no
        // longer this browser's to give up.
        void room
          .sequence({ kind: 'el-delta', tabId, elementId: element.id, delta })
          .then(() => settle(id, true));
      }),
    [tickTabs, roomRef, settle],
  );

  const pendingIdeaIds = useCallback<PendingIdeaIds>((tabId, elementId) => {
    const ids: string[] = [];
    for (const [id, p] of pending.current) {
      if (p.tabId === tabId && p.elementId === elementId) ids.push(id);
    }
    return ids;
  }, []);

  // Each pending card, against the box as it now stands.
  useEffect(() => {
    for (const [id, p] of [...pending.current]) {
      const el = tabs.find((t) => t.id === p.tabId)?.elements.find((e) => e.id === p.elementId);
      // The box went, or was emptied for a new round: not a refusal.
      if (!el || el.type !== 'shape' || (el.collabRound ?? undefined) !== p.round) {
        settle(id, true);
        continue;
      }
      if (el.ideaCardIds?.includes(id)) p.seen = true;
      else if (p.seen) {
        debugLog('[idea-box] post yielded to an earlier card', { elementId: p.elementId });
        settle(id, false);
        onRefused.current(IDEA_BOX_FULL_MESSAGE);
      }
    }
  }, [tabs, settle, onRefused]);

  return { post, pendingIdeaIds };
}
