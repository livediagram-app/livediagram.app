'use client';

// Who the comment composers may @-mention (docs/specs/012-collaboration/comment-mentions.md), handed down
// from the editor so both composers (the Comment panel card's and the comment
// popover's) read one list without threading it through the canvas. Outside
// the editor (the embed, an export) there is nobody: the default.

import { createContext, useContext } from 'react';
import type { MentionCandidate } from '@/hooks/collab/useCommentMentions';

export type MentionScope = {
  candidates: MentionCandidate[];
  // Whether this document has a team to mention from at all. False on a
  // personal document and for a guest, where typing `@` shows a hint instead.
  available: boolean;
};

export const MentionContext = createContext<MentionScope>({ candidates: [], available: false });

export function useMentionScope(): MentionScope {
  return useContext(MentionContext);
}
