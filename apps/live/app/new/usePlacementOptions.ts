'use client';

import { useEffect, useState } from 'react';
import type { PickerFolder } from '@/components/placement/PlacementBrowser';
import {
  apiCreateFolder,
  apiCreateTeam,
  apiGetTeamLibrary,
  apiListFolders,
  apiListTeams,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Where a new diagram can be filed: the personal folders, the teams, and each
// team's folders, plus the inline "New Folder" the Settings step offers
// (docs/specs/006-diagram/offline-mode.md, extended by docs/specs/013-workspace/team-shared-diagrams.md).
//
// One concern, so one hook: the three lists are fetched together, and creating
// a folder has to land in whichever of them the user was browsing. Split
// across the page they were three useStates, a forty-line effect and a handler
// sitting between unrelated parts of the create flow.
//
// Everything degrades rather than throws. A folder or team fetch that fails
// leaves an empty list, because being unable to offer a team is not a reason to
// block someone making a diagram — they land in Unsorted and can move it later.
export function usePlacementOptions({
  selfId,
  clerkUserId,
}: {
  /** The resolved owner id, or 'pending' while identity is still bootstrapping. */
  selfId: string;
  /** Set once signed in. Teams are Clerk-only, so guests skip that fetch. */
  clerkUserId: string | null | undefined;
}) {
  // Personal folders + teams offered by the Settings step's placement picker
  // (docs/specs/006-diagram/offline-mode.md). Folders work for guests; teams are Clerk-only, so we only fetch
  // them once signed in. Empty until the fetch settles / for signed-out users.
  const [folders, setFolders] = useState<PickerFolder[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  // Per-team folder lists for the placement browser's second level, fetched
  // alongside the team list (teams are few, so eager Promise.all is fine).
  const [teamFolders, setTeamFolders] = useState<Record<string, PickerFolder[]>>({});

  // Load the placement options for the Settings step once identity resolves.
  // Personal folders only (a team's folders live under their own optgroup);
  // teams are Clerk-only so they're skipped for guests.
  useEffect(() => {
    if (selfId === 'pending') return;
    let cancelled = false;
    void (async () => {
      const list = await apiListFolders(selfId).catch(() => []);
      if (!cancelled) {
        setFolders(
          list
            .filter((f) => f.teamId == null)
            .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
        );
      }
    })();
    if (clerkUserId) {
      void (async () => {
        const list = await apiListTeams(selfId).catch(() => []);
        if (cancelled) return;
        setTeams(list.map((t) => ({ id: t.id, name: t.name })));
        // Second level of the placement browser: each team's folders.
        const libs = await Promise.all(
          list.map((t) =>
            apiGetTeamLibrary(selfId, t.id)
              .then(
                (lib) =>
                  [
                    t.id,
                    lib.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
                  ] as const,
              )
              .catch(() => [t.id, []] as const),
          ),
        );
        if (!cancelled) setTeamFolders(Object.fromEntries(libs));
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [selfId, clerkUserId]);

  // Inline folder creation from the Settings step's placement browser
  // (docs/specs/006-diagram/offline-mode.md follow-up): create in the right scope (personal, or a team's
  // library) under the open parent, merge into the picker lists, and hand
  // the new folder back so the browser can select it.
  const createPickerFolder = async (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ): Promise<PickerFolder | null> => {
    try {
      const folder = await apiCreateFolder(selfId, {
        id: crypto.randomUUID(),
        name,
        parentId,
        teamId,
      });
      const pf: PickerFolder = { id: folder.id, name: folder.name, parentId: folder.parentId };
      if (teamId) {
        setTeamFolders((m) => ({ ...m, [teamId]: [...(m[teamId] ?? []), pf] }));
      } else {
        setFolders((list) => [...list, pf]);
      }
      return pf;
    } catch {
      return null;
    }
  };

  // Inline team creation from the space overview (docs/specs/013-workspace/teams.md): the new team
  // joins the picker's lists with an empty library, and the browser enters
  // it. Only offered once signed in (the caller gates on clerkUserId).
  const createPickerTeam = async (name: string): Promise<{ id: string; name: string } | null> => {
    try {
      const team = await apiCreateTeam(selfId, { id: crypto.randomUUID(), name });
      const item = { id: team.id, name: team.name };
      setTeams((list) => [...list, item].sort((a, b) => a.name.localeCompare(b.name)));
      setTeamFolders((m) => ({ ...m, [team.id]: [] }));
      track('Team', 'Created');
      return item;
    } catch {
      return null;
    }
  };

  return { folders, teams, teamFolders, createPickerFolder, createPickerTeam };
}
