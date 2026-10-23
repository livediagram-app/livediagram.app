'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiCreateTeam,
  apiListTeamInvites,
  apiListTeams,
  type TeamInvite,
  type TeamListItem,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Teams list + pending invites state (docs/specs/013-workspace/teams.md), shaped after
// useFolders so the Explorer composes both the same way. Signed-in
// only: callers pass `enabled: false` for guests (the api 401s the
// guest path anyway, this just avoids the doomed request). Invitations
// are answered on liveworkspace.app, and team administration happens
// there too; TeamPane calls `refresh` to resync.

type UseTeamsResult = {
  teams: TeamListItem[];
  invites: TeamInvite[];
  loading: boolean;
  createTeam: (input: {
    name: string;
    organisation?: string | null;
  }) => Promise<TeamListItem | undefined>;
  refresh: () => Promise<void>;
};

// `invites: false` reads the teams alone: a workspace frame reaches no team administration, invites included
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB62).
export function useTeams(
  ownerId: string | null,
  opts: { enabled: boolean; invites?: boolean },
): UseTeamsResult {
  const { enabled } = opts;
  const withInvites = opts.invites ?? true;
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(enabled);

  // Settles `loading` from the response callbacks, never synchronously, so
  // the load effect below only starts the request.
  const load = useCallback(
    (owner: string) =>
      // The list call runs the server-side lazy claim; the invites
      // call repeats it, so the pair is order-independent.
      Promise.all([apiListTeams(owner), withInvites ? apiListTeamInvites(owner) : []])
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
    [withInvites],
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

  // Nothing loads for a guest or before the owner resolves: nothing to wait for.
  return {
    teams,
    invites,
    loading: enabled && ownerId ? loading : false,
    createTeam,
    refresh,
  };
}
