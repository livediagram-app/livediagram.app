'use client';

// Who a comment can @-mention, and what follows a mention (docs/specs/012-collaboration/comment-mentions.md). The
// candidates were the members of the team whose library holds the plan. Teams are liveworkspace's now (an account's
// token names the teams it has joined, liveworkspace/docs/accounts.md "Teams"), and their member lists are not
// offered to apps yet, so there is nobody to suggest: an @ in a comment stays plain text, and a mention is counted.

import { useCallback } from 'react';
import type { CommentMention } from '@liveplanner/project';
import { track } from '@/lib/telemetry';

export type MentionCandidate = CommentMention & { memberId: string; pending: boolean };

const NONE: MentionCandidate[] = [];

export function useCommentMentions(_input: {
  // The signed-in account; null for a guest.
  ownerId: string | null;
  teams: readonly { id: string; name: string }[];
  projectTeamId: string | null;
  projectId: string | null;
}) {
  const notifyMentioned = useCallback(
    (_text: string, mentions: readonly CommentMention[], _itemId?: string, _commentId?: string) => {
      if (mentions.length > 0) track('Comment', 'Mentioned');
    },
    [],
  );
  return { candidates: NONE, available: false, notifyMentioned };
}
