'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiCreateTeam, apiListTeams, type TeamListItem } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Teams list state + create (spec/32), shaped after useFolders so the
// Explorer composes both the same way. Signed-in only: callers pass
// `enabled: false` for guests (the api 401s the guest path anyway,
// this just avoids the doomed request). Team-detail mutations (edit /
// delete / members) live with TeamPane — they need the detail payload
// this hook never holds — and call `refresh` to resync the list.

type UseTeamsResult = {
  teams: TeamListItem[];
  loading: boolean;
  createTeam: (input: {
    name: string;
    organisation?: string | null;
  }) => Promise<TeamListItem | undefined>;
  refresh: () => Promise<void>;
};

export function useTeams(ownerId: string | null, opts: { enabled: boolean }): UseTeamsResult {
  const { enabled } = opts;
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!ownerId || !enabled) return;
    setLoading(true);
    try {
      const list = await apiListTeams(ownerId);
      setTeams(list);
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

  return { teams, loading, createTeam, refresh };
}
