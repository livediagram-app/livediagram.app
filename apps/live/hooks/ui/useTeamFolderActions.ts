import { useMemo } from 'react';
import type { TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import type { TeamFolderHandlers } from '@/components/panels/Explorer.types';
import { apiCreateFolder, apiDeleteFolder, apiUpdateFolder } from '@/lib/api-client';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { track } from '@/lib/telemetry';
import { folderDeleteConfirmation } from '@/lib/folder-delete-confirmation';
import { folderDefaultKeys } from '@/lib/placement-defaults/default-destination';
import { placementDefaultsSnapshot } from '@/lib/placement-defaults/placement-defaults-store';

// Team-library folder mutations for the Explorer panel's team tree
// (docs/specs/013-workspace/team-shared-documents.md), lifted out of EditorCanvasHost. Straight api calls plus a
// sweep refresh: the swept team libraries are the panel's source, so a
// mutation re-reads them rather than patching a copy. Teams are Clerk-only,
// so signed out = no handlers at all, which is what hides the verbs.
// Every emit carries the `Team` type (docs/specs/017-telemetry/telemetry.md Folder), the same as the
// team library's own folder verbs, so a team folder never reads as a
// personal Explorer one.
export function useTeamFolderActions({
  clerkUserId,
  viewerId,
  teamFolders,
  refreshTeamLibraries,
  confirm,
}: {
  clerkUserId: string | null | undefined;
  viewerId: string | null;
  teamFolders: TeamFolderRow[];
  refreshTeamLibraries: () => void;
  confirm: ReturnType<typeof useConfirm>;
}): TeamFolderHandlers | undefined {
  return useMemo<TeamFolderHandlers | undefined>(() => {
    if (!clerkUserId || !viewerId) return undefined;
    return {
      create: async (teamId, parentId) => {
        try {
          const folder = await apiCreateFolder(viewerId, {
            id: crypto.randomUUID(),
            name: 'New folder',
            parentId,
            teamId,
          });
          track('Folder', 'Created', 'Team');
          refreshTeamLibraries();
          return folder;
        } catch {
          return undefined;
        }
      },
      rename: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        void apiUpdateFolder(viewerId, id, { name: trimmed })
          .then(() => {
            track('Folder', 'Renamed', 'Team');
            refreshTeamLibraries();
          })
          .catch(() => {});
      },
      delete: (id) => {
        const folder = teamFolders.find((f) => f.id === id);
        // The one folder delete confirmation (docs/specs/013-workspace/folders.md "Deleting a
        // folder"): its documents and subfolders move up to its parent, the team's root at the top.
        void confirm(
          folderDeleteConfirmation({
            name: folder?.name ?? '',
            parentName: teamFolders.find((f) => f.id === folder?.parentId)?.name ?? null,
            scope: 'team',
            defaultKeys: folderDefaultKeys(id, placementDefaultsSnapshot().defaults),
          }),
        ).then((ok) => {
          if (!ok) return;
          void apiDeleteFolder(viewerId, id)
            .then(() => {
              track('Folder', 'Deleted', 'Team');
              refreshTeamLibraries();
            })
            .catch(() => {});
        });
      },
    };
  }, [clerkUserId, viewerId, refreshTeamLibraries, confirm, teamFolders]);
}
