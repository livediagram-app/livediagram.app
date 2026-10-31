// The editor's comment reactions (docs/specs/012-collaboration/comment-reactions.md): who is reacting, whether
// they may, and how a reaction reaches the document, as the scope every comment row reads
// (CommentReactionsContext). A reaction is one `comment-react` delta, applied here at once and sent to the room
// like every comment change, never a history commit. The room stamps the name and key and, for a Participant,
// writes it to the stored tab; an Editor's autosave carries it too.

import { useMemo } from 'react';
import type { CommentThread, Tab } from '@livediagram/document';
import type { CommentReactionScope } from '@liveworkspace/workbench/components/comments/CommentReactionsContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

const threadOf = (el: Tab['elements'][number]): CommentThread | undefined =>
  (el as { commentThread?: CommentThread }).commentThread;

export function useCommentReactionScope(deps: {
  applyElementDelta: ApplyElementDelta;
  activeTab: Tab;
  // This session's collab key and the name it shows.
  selfKey: string;
  selfName: string;
  // Whoever may comment: an Editor or a Participant (`can.takePart`), and never a Community visitor.
  canReact: boolean;
}): CommentReactionScope {
  const { applyElementDelta, selfKey, selfName, canReact } = deps;
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
        applyElementDelta(
          host.id,
          { kind: 'comment-react', commentId, emoji, by: selfKey, name: selfName, on },
          activeTab.id,
        );
      },
    }),
    [applyElementDelta, tabRef, selfKey, selfName, canReact],
  );
}
