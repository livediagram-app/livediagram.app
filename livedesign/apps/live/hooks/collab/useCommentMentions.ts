'use client';

// Who a comment can @-mention, and the notify that follows a mention
// (docs/specs/012-collaboration/comment-mentions.md). The candidates are the members of the team whose library
// holds this design, joined and invited, except yourself: the Assign Action
// picker's rule, for the same reason (a mention should reach someone who can
// open the design). A personal design or a guest has none.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { assignHandles, type CommentMention } from '@livedesign/design';
import { apiGetTeam, apiNotifyMention, type TeamListItem } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { teamMemberRows } from './team-member-rows';

export type MentionCandidate = CommentMention & { memberId: string; pending: boolean };

const NONE: MentionCandidate[] = [];

export function useCommentMentions({
  ownerId,
  teams,
  designTeamId,
  designId,
}: {
  // The signed-in account; null for a guest (no teams, no mentions).
  ownerId: string | null;
  teams: TeamListItem[];
  designTeamId: string | null;
  designId: string | null;
}) {
  const team = useMemo(
    () => (ownerId ? (teams.find((t) => t.id === designTeamId) ?? null) : null),
    [ownerId, teams, designTeamId],
  );
  const key = team && ownerId ? `${ownerId}:${team.id}` : null;
  const [loaded, setLoaded] = useState<{ key: string; list: MentionCandidate[] } | null>(null);

  // One load per (account, team). A failure leaves the list empty: nobody to
  // suggest, and the comment still posts as plain text.
  useEffect(() => {
    if (!key || !team || !ownerId) return;
    let cancelled = false;
    void apiGetTeam(ownerId, team.id)
      .then((detail) => {
        const rows = teamMemberRows(detail.members, team, ownerId).map((m) => ({
          ...m,
          name: m.name.trim() || m.email || 'Teammate',
        }));
        const list = assignHandles(rows).map((m): MentionCandidate => ({
          userId: m.userId,
          memberId: m.memberId!,
          name: m.name,
          handle: m.handle,
          pending: !!m.pending,
        }));
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

  // After a comment with mentions lands: count it, and ask the api to email
  // them. Fire-and-forget; the comment has already persisted locally.
  const notifyMentioned = useCallback(
    (text: string, mentions: readonly CommentMention[]) => {
      if (mentions.length === 0) return;
      track('Comment', 'Mentioned');
      if (!ownerId || !team || !designId) return;
      void apiNotifyMention(ownerId, team.id, {
        designId,
        commentText: text,
        mentions: mentions.map((m) => ({
          userId: m.userId,
          ...(m.memberId ? { memberId: m.memberId } : {}),
        })),
      }).catch(() => {});
    },
    [ownerId, team, designId],
  );

  return { candidates, available: team !== null, notifyMentioned };
}
