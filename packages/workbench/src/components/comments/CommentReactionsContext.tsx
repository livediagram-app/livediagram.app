'use client';

// Who is reacting and how a reaction reaches the document (docs/specs/012-collaboration/comment-reactions.md),
// handed down from each editor so every comment row (the canvas's popover, the Comment panel, a Plan card's
// threads) reads one scope without threading it through the canvas. Outside an editor (an embed, an export) there
// is nobody to react: the default draws the chips read-only and offers no tray.

import { createContext, useContext, type ReactNode } from 'react';
import type {
  CommentReaction,
  CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';
import {
  AddReactionButton,
  CommentReactions,
  type ReactionDensity,
  type ReactionTray,
} from './CommentReactions';

export type CommentReactionScope = {
  // This session's collab key (the public id its answers are recorded under), null where it has none yet.
  selfKey: string | null;
  selfName?: string;
  // Whoever may comment may react: an Editor or a Participant, never a Viewer.
  canReact: boolean;
  // Turn this session's `emoji` on or off on the comment `commentId`. The host finds the comment and sends the
  // change the way its comments travel.
  toggle: (commentId: string, emoji: CommentReactionId, on: boolean) => void;
};

const NOBODY: CommentReactionScope = { selfKey: null, canReact: false, toggle: () => {} };

export const CommentReactionsContext = createContext<CommentReactionScope>(NOBODY);

export function CommentReactionsProvider({
  value,
  children,
}: {
  value: CommentReactionScope;
  children: ReactNode;
}) {
  return (
    <CommentReactionsContext.Provider value={value}>{children}</CommentReactionsContext.Provider>
  );
}

export function useCommentReactionScope(): CommentReactionScope {
  return useContext(CommentReactionsContext);
}

// The row's add-reaction trigger, from the scope: nothing for a session that may not react, or (`closed`) on a
// comment in a resolved thread, which reads but takes no new reactions.
export function ScopedAddReactionButton({
  tray,
  density,
  closed = false,
}: {
  tray: ReactionTray;
  density?: ReactionDensity;
  closed?: boolean;
}) {
  const scope = useCommentReactionScope();
  if (!scope.canReact || closed) return null;
  return <AddReactionButton tray={tray} density={density} />;
}

// The row's chips and tray, from the scope.
export function ScopedCommentReactions({
  commentId,
  reactions,
  tray,
  density,
  closed = false,
}: {
  commentId: string;
  reactions: readonly CommentReaction[] | undefined;
  tray: ReactionTray;
  density?: ReactionDensity;
  closed?: boolean;
}) {
  const scope = useCommentReactionScope();
  return (
    <CommentReactions
      reactions={reactions}
      selfKey={scope.selfKey}
      selfName={scope.selfName}
      canReact={scope.canReact && !closed}
      onToggle={(emoji, on) => scope.toggle(commentId, emoji, on)}
      tray={tray}
      density={density}
    />
  );
}
