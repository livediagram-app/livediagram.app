'use client';

// Who a comment can @-mention, and what follows a mention (docs/specs/012-collaboration/comment-mentions.md). The
// candidates are the people of the team whose library holds this design, joined and invited, except yourself: the
// Assign Action picker's rule, for the same reason (a mention should reach someone who can open the design). A
// personal design or a guest has none. The team is one the account's token names (liveworkspace/docs/accounts.md
// "Teams"); its people come from the api, which reads them from liveworkspace.
//
// The email itself is the api's: it sends one to each person a comment mentions when the comment is saved (a
// card's comment at once, a canvas comment with the tab), from what was stored, so nothing here asks for it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { assignHandles, type CommentMention } from '@livedesign/design';
import { apiTeamMembers } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { teamMemberRows } from './team-member-rows';

export type MentionCandidate = CommentMention & { memberId: string; pending: boolean };

const NONE: MentionCandidate[] = [];

export function useCommentMentions({
  ownerId,
  teams,
  designTeamId,
}: {
  // The signed-in account; null for a guest (no teams, no mentions).
  ownerId: string | null;
  teams: readonly { id: string; name: string }[];
  designTeamId: string | null;
  designId: string | null;
}) {
  const team = useMemo(
    () => (ownerId ? (teams.find((t) => t.id === designTeamId) ?? null) : null),
    [ownerId, teams, designTeamId],
  );
  const key = team && ownerId ? `${ownerId}:${team.id}` : null;
  const [loaded, setLoaded] = useState<{ key: string; list: MentionCandidate[] } | null>(null);

  // One load per (account, team). A failure leaves the list empty: nobody to suggest, and the comment still
  // posts as plain text.
  useEffect(() => {
    if (!key || !team || !ownerId) return;
    let cancelled = false;
    void apiTeamMembers(ownerId, team.id)
      .then((members) => {
        const rows = teamMemberRows(members, team, ownerId);
        const list = assignHandles(rows).map(
          (m): MentionCandidate => ({
            userId: m.userId,
            memberId: m.memberId!,
            name: m.name,
            handle: m.handle,
            pending: !!m.pending,
          }),
        );
        if (!cancelled) setLoaded({ key, list });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, list: NONE });
      });
    return () => {
      cancelled = true;
    };
  }, [key, team, ownerId]);

  const candidates = loaded && loaded.key === key ? loaded.list : NONE;

  // After a comment with mentions lands: count it. The api emails the people it mentions.
  const notifyMentioned = useCallback(
    (_text: string, mentions: readonly CommentMention[], _itemId?: string, _commentId?: string) => {
      if (mentions.length > 0) track('Comment', 'Mentioned');
    },
    [],
  );

  return { candidates, available: team !== null, notifyMentioned };
}
