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

// Teams list + pending invites state (docs/specs/013-workspace/teams.md), shaped after
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

  // Settles `loading` from the response callbacks, never synchronously, so
  // the load effect below only starts the request.
  const load = useCallback(
    (owner: string) =>
      // The list call runs the server-side lazy claim; the invites
      // call repeats it, so the pair is order-independent.
      Promise.all([apiListTeams(owner), apiListTeamInvites(owner)])
        .then(
          ([teamList, inviteList]) => {
            setTeams(teamList);
            setInvites(inviteList);
          },
          () => {
            // Silent failure, same rationale as useFolders: a transient
            // hiccup shouldn't wipe whatever we've already loaded.
          },
        )
        .finally(() => setLoading(false)),
    [],
  );

  const refresh = useCallback(async () => {
    if (!ownerId || !enabled) return;
    setLoading(true);
    await load(ownerId);
  }, [ownerId, enabled, load]);

  // A newly enabled owner is loading from its first render.
  const loadOwner = enabled ? ownerId : null;
  const [loadingFor, setLoadingFor] = useState(loadOwner);
  if (loadOwner !== loadingFor) {
    setLoadingFor(loadOwner);
    if (loadOwner) setLoading(true);
  }

  useEffect(() => {
    if (loadOwner) void load(loadOwner);
  }, [loadOwner, load]);

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
        // The RECIPIENT saying no, which is not the same fact as an admin
        // withdrawing the invitation (that one keeps `Team·Removed·Invite`,
        // docs/specs/017-telemetry/telemetry.md). This used to emit that event, so the two were pooled and
        // the accept-vs-decline ratio on an invite — the only number that says
        // whether invitations are landing — could not be read at all.
        track('Team', 'Declined', 'Invite');
        setInvites((prev) => prev.filter((i) => i.memberId !== invite.memberId));
      } catch {
        // Leave the card in place; the next refresh reconciles.
      }
    },
    [ownerId, enabled],
  );

  // Nothing loads for a guest or before the owner resolves: nothing to wait for.
  return {
    teams,
    invites,
    loading: enabled && ownerId ? loading : false,
    createTeam,
    acceptInvite,
    declineInvite,
    refresh,
  };
}
