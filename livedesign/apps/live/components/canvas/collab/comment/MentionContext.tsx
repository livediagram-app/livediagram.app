'use client';

// Who the comment composers may @-mention (docs/specs/012-collaboration/comment-mentions.md), handed down
// from the editor so the comment composers read one list without threading it through the canvas. Outside
// the editor (the embed, an export) there is nobody: the default.

import { createContext, useContext } from 'react';
import type { MentionCandidate } from '@/hooks/collab/useCommentMentions';

export type MentionScope = {
  candidates: MentionCandidate[];
  // Whether this design has a team to mention from at all. False on a
  // personal design and for a guest, where typing `@` shows a hint instead.
  available: boolean;
};

export const MentionContext = createContext<MentionScope>({ candidates: [], available: false });

export function useMentionScope(): MentionScope {
  return useContext(MentionContext);
}
