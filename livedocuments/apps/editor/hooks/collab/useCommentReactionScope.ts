// The editor's comment reactions (docs/specs/012-collaboration/comment-reactions.md): who is reacting, whether
// they may, and how a reaction reaches the document, as the scope every comment row reads
// (CommentReactionsContext). A reaction is one `comment-react` delta, applied here at once, never a history commit.
// An Editor's is sent to the room like every comment change (the room stamps the name and key, and the autosave
// carries it); a Participant's, which the room would not relay, goes through the comment endpoint, which writes it
// and relays it, and is taken back here if the endpoint refuses.

import { useMemo } from 'react';
import type { CommentThread, Tab } from '@livedocuments/document';
import type { CommentReactionScope } from '@liveworkspace/workbench/components/comments/CommentReactionsContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';
import { commentPersisters } from '@/lib/comment-persistence';

const threadOf = (el: Tab['elements'][number]): CommentThread | undefined =>
  (el as { commentThread?: CommentThread }).commentThread;

export function useCommentReactionScope(deps: {
  applyElementDelta: ApplyElementDelta;
  activeTab: Tab;
  // This session's collab key and the name it shows.
  selfKey: string;
  selfName: string;
  // Whoever may comment: an Editor or a Participant (`can.takePart`).
  canReact: boolean;
  // A session that may not edit saves through the comment endpoints (lib/comment-persistence.ts).
  readOnly: boolean;
  documentId: string | null;
  selfId: string;
  shareCode: string | null;
}): CommentReactionScope {
  const {
    applyElementDelta,
    selfKey,
    selfName,
    canReact,
    readOnly,
    documentId,
    selfId,
    shareCode,
  } = deps;
  // Read at press time, so the scope (and every row reading it) stays the same object while the canvas changes.
  const tabRef = useLatest(deps.activeTab);
  return useMemo(
    () => ({
      selfKey,
      selfName,
      canReact,
      toggle: (commentId, emoji, on) => {
        if (!canReact) return;
        const activeTab = tabRef.current;
        // Comment ids are unique on a tab, so the comment names its element.
        const host = activeTab.elements.find((el) =>
          threadOf(el)?.comments.some((c) => c.id === commentId),
        );
        if (!host) return;
        const change = {
          kind: 'comment-react',
          commentId,
          emoji,
          by: selfKey,
          name: selfName,
        } as const;
        applyElementDelta(host.id, { ...change, on }, activeTab.id);
        const persist = commentPersisters({
          readOnly,
          documentId,
          tabId: activeTab.id,
          selfId,
          shareCode,
        }).react(commentId, { emoji, on, key: selfKey });
        if (!persist) return;
        void persist().catch((err: unknown) => {
          // Refused, it goes back, so this screen never shows a reaction nobody else sees.
          console.warn('[comments] reaction not saved', { error: String(err) });
          applyElementDelta(host.id, { ...change, on: !on }, activeTab.id);
        });
      },
    }),
    [
      applyElementDelta,
      tabRef,
      selfKey,
      selfName,
      canReact,
      readOnly,
      documentId,
      selfId,
      shareCode,
    ],
  );
}
