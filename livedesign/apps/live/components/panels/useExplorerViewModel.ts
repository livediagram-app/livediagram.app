import { useMemo } from 'react';

import { groupBy, groupDesignsByFolder, indexFolders } from '@/lib/folder-tree';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { ExplorerProps } from './Explorer.types';

type ExplorerViewModelDeps = Pick<
  ExplorerProps,
  'designs' | 'folders' | 'currentDesignId' | 'shared' | 'teamFolders' | 'teamDesigns'
> & {
  deletedTeamIds: Set<string>;
};

// Derives the Explorer panel's view-model from the raw design / folder / team
// / shared inputs: the current design (resolved across personal, team, and
// shared sources) and the by-folder / by-team / by-parent groupings the
// panel's tree renders (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel). Pure memoised derivation, split out of
// Explorer so the component is left with wiring + render.
export function useExplorerViewModel({
  designs: liveDocs,
  folders,
  currentDesignId,
  shared = [],
  teamFolders = [],
  teamDesigns = [],
  deletedTeamIds,
}: ExplorerViewModelDeps) {
  const current = useMemo(
    () => (currentDesignId ? (liveDocs.find((d) => d.id === currentDesignId) ?? null) : null),
    [liveDocs, currentDesignId],
  );
  // Team rows minus any the viewer just deleted (see deletedTeamIds).
  const visibleTeamDesigns = useMemo(
    () =>
      deletedTeamIds.size === 0
        ? teamDesigns
        : teamDesigns.filter((d) => !deletedTeamIds.has(d.id)),
    [teamDesigns, deletedTeamIds],
  );
  // When the open design lives in a team library it won't be in
  // `designs` (those are personal only). Fall back to the swept team
  // designs so the Current Design section renders for team designs.
  const currentTeam = useMemo(
    () =>
      !current && currentDesignId
        ? (visibleTeamDesigns.find((d) => d.id === currentDesignId) ?? null)
        : null,
    [current, visibleTeamDesigns, currentDesignId],
  );
  // When the open design is shared (not owned / not team), it won't
  // appear in `designs` either. Fall back to the shared list so the
  // Current Design section still renders for visitors.
  const currentShared = useMemo(
    () =>
      !current && !currentTeam && currentDesignId
        ? (shared.find((s) => s.id === currentDesignId) ?? null)
        : null,
    [current, currentTeam, shared, currentDesignId],
  );
  // This team's folder rows and designs, indexed by team, for the Teams
  // accordion, which shows the designs inside each team folder (docs/specs/013-workspace/team-shared-designs.md).
  const foldersByTeam = useMemo(() => groupBy(teamFolders, (f) => f.teamId), [teamFolders]);
  const designsByTeam = useMemo(
    () => groupBy(visibleTeamDesigns, (d) => d.team.id),
    [visibleTeamDesigns],
  );

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = useMemo(() => indexFolders(folders).childrenByParent, [folders]);

  // Offline designs (docs/specs/006-design/offline-mode.md) stay out of the My Work root: they
  // render under the panel's This Browser row instead.
  const designsByFolder = useMemo(
    () =>
      groupDesignsByFolder(liveDocs, {
        exclude: (d) => d.folderId === null && d.ownerId === OFFLINE_OWNER_ID,
      }),
    [liveDocs],
  );

  // Offline designs (docs/specs/006-design/offline-mode.md): everything saved only in this browser,
  // regardless of any folder placement in the local record, for the panel's
  // This Browser row (mirrors the /explorer route).
  const offlineDesigns = useMemo(
    () =>
      liveDocs.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  return {
    current,
    currentTeam,
    currentShared,
    foldersByTeam,
    designsByTeam,
    foldersByParent,
    designsByFolder,
    offlineDesigns,
  };
}
