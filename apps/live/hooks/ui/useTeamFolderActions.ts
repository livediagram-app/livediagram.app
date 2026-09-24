import { useMemo } from 'react';
import type { TeamFolderRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import type { TeamFolderHandlers } from '@/components/panels/Explorer.types';
import { apiCreateFolder, apiDeleteFolder, apiUpdateFolder } from '@/lib/api-client';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { track } from '@/lib/telemetry';

// Team-library folder mutations for the Explorer panel's team tree
// (spec/35), lifted out of EditorCanvasHost. Straight api calls plus a
// sweep refresh: the swept team libraries are the panel's source, so a
// mutation re-reads them rather than patching a copy. Teams are Clerk-only,
// so signed out = no handlers at all, which is what hides the verbs.
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
          track('Folder', 'Created');
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
            track('Folder', 'Renamed');
            refreshTeamLibraries();
          })
          .catch(() => {});
      },
      delete: (id) => {
        const name = teamFolders.find((f) => f.id === id)?.name;
        // The same confirm the personal tree's delete uses, with the same
        // consequences spelled out: a team folder's diagrams go to the
        // team's Unsorted and its subfolders are promoted.
        void confirm({
          title: name ? `Delete "${name}"?` : 'Delete this folder?',
          message:
            'Diagrams inside the folder move to Unsorted. Subfolders are promoted to the root. The folder row itself is removed.',
          confirmLabel: 'Delete folder',
        }).then((ok) => {
          if (!ok) return;
          void apiDeleteFolder(viewerId, id)
            .then(() => {
              track('Folder', 'Deleted');
              refreshTeamLibraries();
            })
            .catch(() => {});
        });
      },
    };
  }, [clerkUserId, viewerId, refreshTeamLibraries, confirm, teamFolders]);
}
