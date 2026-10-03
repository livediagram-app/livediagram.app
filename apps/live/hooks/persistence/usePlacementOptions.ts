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

// Where a new document can be filed: the personal folders, the teams, and each
// team's folders, plus the inline "New Folder" the Settings step offers
// (docs/specs/006-document/offline-mode.md, extended by docs/specs/013-workspace/team-shared-documents.md).
//
// One concern, so one hook: the three lists are fetched together, and creating
// a folder has to land in whichever of them the user was browsing. Split
// across the page they were three useStates, a forty-line effect and a handler
// sitting between unrelated parts of the create flow.
//
// Everything degrades rather than throws. A folder or team fetch that fails
// leaves an empty list, because being unable to offer a team is not a reason to
// block someone making a document — they land at the root of My documents and can move it later.
export function usePlacementOptions({
  selfId,
  clerkUserId,
  skip,
}: {
  /** The resolved owner id, or 'pending' while identity is still bootstrapping. */
  selfId: string;
  /** Set once signed in. Teams are Clerk-only, so guests skip that fetch. */
  clerkUserId: string | null | undefined;
  /**
   * Whether /new commits straight away (?blank=1, ?template=: the hero's launch, the gallery
   * links): no Settings step shows, so its placement options are never read, and the editor
   * loads the folders it needs itself. A function read when the fetch would start, not a
   * rendered flag: a returning guest's id is known on the very first render, while a
   * URL-derived flag still holds its prerendered value there.
   */
  skip?: () => boolean;
}) {
  // Personal folders + teams offered by the Settings step's placement picker
  // (docs/specs/006-document/offline-mode.md). Folders work for guests; teams are Clerk-only, so we only fetch
  // them once signed in. Empty until the fetch settles / for signed-out users.
  const [folders, setFolders] = useState<PickerFolder[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  // Per-team folder lists for the placement browser's second level, fetched
  // alongside the team list (teams are few, so eager Promise.all is fine).
  const [teamFolders, setTeamFolders] = useState<Record<string, PickerFolder[]>>({});
  // Whether the lists are complete for this owner (folders, and teams with their folders once
  // signed in): a surface that tells "gone" from "not loaded yet" waits for it (Settings' default
  // folders, docs/specs/013-workspace/default-folders.md).
  // The owner whose lists could not all be read: "gone" cannot be told from "unreadable" then.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<{
    owner: string;
    folders: boolean;
    teams: boolean;
  } | null>(null);

  // Load the placement options for the Settings step once identity resolves.
  // Personal folders only (a team's folders live under their own optgroup);
  // teams are Clerk-only so they're skipped for guests.
  useEffect(() => {
    if (selfId === 'pending' || skip?.()) return;
    let cancelled = false;
    void (async () => {
      const fetched = await apiListFolders(selfId).catch(() => null);
      if (!cancelled) {
        if (!fetched) setFailedFor(selfId);
        const list = fetched ?? [];
        setFolders(
          list
            .filter((f) => f.teamId == null)
            .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
        );
        setLoadedFor((l) => ({
          owner: selfId,
          teams: l?.owner === selfId ? l.teams : false,
          folders: fetched !== null,
        }));
      }
    })();
    if (clerkUserId) {
      void (async () => {
        const fetchedTeams = await apiListTeams(selfId).catch(() => null);
        if (cancelled) return;
        if (!fetchedTeams) setFailedFor(selfId);
        const list = fetchedTeams ?? [];
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
              .catch(() => {
                setFailedFor(selfId);
                return [t.id, []] as const;
              }),
          ),
        );
        if (cancelled) return;
        setTeamFolders(Object.fromEntries(libs));
        setLoadedFor((l) => ({
          owner: selfId,
          folders: l?.owner === selfId ? l.folders : false,
          teams: true,
        }));
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [selfId, clerkUserId, skip]);

  // Inline folder creation from the Settings step's placement browser
  // (docs/specs/006-document/offline-mode.md follow-up): create in the right scope (personal, or a team's
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

  const ready =
    loadedFor?.owner === selfId && loadedFor.folders && (loadedFor.teams || !clerkUserId);
  const failed = failedFor === selfId;
  return { folders, teams, teamFolders, createPickerFolder, createPickerTeam, ready, failed };
}
