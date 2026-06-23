'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiAcceptTeamInvite,
  apiCreateTeam,
  apiListTeamInvites,
  apiListTeams,
  apiRemoveTeamMember,
  type TeamInvite,
  type TeamListItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Teams list + pending invites state (spec/32), shaped after
// useFolders so the Explorer composes both the same way. Signed-in
// only: callers pass `enabled: false` for guests (the api 401s the
// guest path anyway, this just avoids the doomed request). The two
// lists are two sides of the accept/decline handshake — accepting
// moves a team from `invites` into `teams`, declining drops it —
// so the hook owns both and keeps them consistent. Team-detail
// mutations (edit / delete / members) live with TeamPane and call
// `refresh` to resync.

type UseTeamsResult = {
  teams: TeamListItem[];
  invites: TeamInvite[];
  loading: boolean;
  createTeam: (input: {
    name: string;
    organisation?: string | null;
  }) => Promise<TeamListItem | undefined>;
  // Accept a pending invite. Resolves to the joined team's id (for
  // the caller to select it) or undefined on failure.
  acceptInvite: (invite: TeamInvite) => Promise<string | undefined>;
  declineInvite: (invite: TeamInvite) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useTeams(ownerId: string | null, opts: { enabled: boolean }): UseTeamsResult {
  const { enabled } = opts;
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!ownerId || !enabled) return;
    setLoading(true);
    try {
      // The list call runs the server-side lazy claim; the invites
      // call repeats it, so the pair is order-independent.
      const [teamList, inviteList] = await Promise.all([
        apiListTeams(ownerId),
        apiListTeamInvites(ownerId),
      ]);
      setTeams(teamList);
      setInvites(inviteList);
    } catch {
      // Silent failure, same rationale as useFolders: a transient
      // hiccup shouldn't wipe whatever we've already loaded.
    } finally {
      setLoading(false);
    }
  }, [ownerId, enabled]);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, ownerId, refresh]);

  const createTeam = useCallback(
    async (input: { name: string; organisation?: string | null }) => {
      if (!ownerId || !enabled) return undefined;
      const name = input.name.trim();
      if (!name) return undefined;
      try {
        const team = await apiCreateTeam(ownerId, {
          id: crypto.randomUUID(),
          name,
          organisation: input.organisation?.trim() || null,
        });
        const item: TeamListItem = { ...team, myRole: 'admin', memberCount: 1 };
        setTeams((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
        track('Team', 'Created');
        return item;
      } catch {
        return undefined;
      }
    },
    [ownerId, enabled],
  );

  const acceptInvite = useCallback(
    async (invite: TeamInvite) => {
      if (!ownerId || !enabled) return undefined;
      try {
        await apiAcceptTeamInvite(ownerId, invite.team.id, invite.memberId);
        track('Team', 'Joined');
        // Optimistic move so the badge and lists react instantly;
        // the refresh reconciles the joined member count.
        setInvites((prev) => prev.filter((i) => i.memberId !== invite.memberId));
        setTeams((prev) =>
          [
            ...prev,
            { ...invite.team, myRole: 'member' as const, memberCount: invite.memberCount + 1 },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
        void refresh();
        return invite.team.id;
      } catch {
        return undefined;
      }
    },
    [ownerId, enabled, refresh],
  );

  const declineInvite = useCallback(
    async (invite: TeamInvite) => {
      if (!ownerId || !enabled) return;
      try {
        await apiRemoveTeamMember(ownerId, invite.team.id, invite.memberId);
        track('Team', 'Removed', 'Invite');
        setInvites((prev) => prev.filter((i) => i.memberId !== invite.memberId));
      } catch {
        // Leave the card in place; the next refresh reconciles.
      }
    },
    [ownerId, enabled],
  );

  return { teams, invites, loading, createTeam, acceptInvite, declineInvite, refresh };
}
