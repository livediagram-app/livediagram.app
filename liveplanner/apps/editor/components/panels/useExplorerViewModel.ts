import { useMemo } from 'react';

import { groupBy, groupProjectsByFolder, indexFolders } from '@/lib/folder-tree';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { ExplorerProps } from './Explorer.types';

type ExplorerViewModelDeps = Pick<
  ExplorerProps,
  'projects' | 'folders' | 'currentProjectId' | 'shared' | 'teamFolders' | 'teamProjects'
> & {
  deletedTeamIds: Set<string>;
};

// Derives the Explorer panel's view-model from the raw project / folder / team
// / shared inputs: the current project (resolved across personal, team, and
// shared sources) and the by-folder / by-team / by-parent groupings the
// panel's tree renders (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel). Pure memoised derivation, split out of
// Explorer so the component is left with wiring + render.
export function useExplorerViewModel({
  projects: liveDocs,
  folders,
  currentProjectId,
  shared = [],
  teamFolders = [],
  teamProjects = [],
  deletedTeamIds,
}: ExplorerViewModelDeps) {
  const current = useMemo(
    () => (currentProjectId ? (liveDocs.find((d) => d.id === currentProjectId) ?? null) : null),
    [liveDocs, currentProjectId],
  );
  // Team rows minus any the viewer just deleted (see deletedTeamIds).
  const visibleTeamProjects = useMemo(
    () =>
      deletedTeamIds.size === 0
        ? teamProjects
        : teamProjects.filter((d) => !deletedTeamIds.has(d.id)),
    [teamProjects, deletedTeamIds],
  );
  // When the open project lives in a team library it won't be in
  // `projects` (those are personal only). Fall back to the swept team
  // projects so the Current Project section renders for team projects.
  const currentTeam = useMemo(
    () =>
      !current && currentProjectId
        ? (visibleTeamProjects.find((d) => d.id === currentProjectId) ?? null)
        : null,
    [current, visibleTeamProjects, currentProjectId],
  );
  // When the open project is shared (not owned / not team), it won't
  // appear in `projects` either. Fall back to the shared list so the
  // Current Project section still renders for visitors.
  const currentShared = useMemo(
    () =>
      !current && !currentTeam && currentProjectId
        ? (shared.find((s) => s.id === currentProjectId) ?? null)
        : null,
    [current, currentTeam, shared, currentProjectId],
  );
  // This team's folder rows and projects, indexed by team, for the Teams
  // accordion, which shows the projects inside each team folder (docs/specs/013-workspace/team-shared-projects.md).
  const foldersByTeam = useMemo(() => groupBy(teamFolders, (f) => f.teamId), [teamFolders]);
  const projectsByTeam = useMemo(
    () => groupBy(visibleTeamProjects, (d) => d.team.id),
    [visibleTeamProjects],
  );

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = useMemo(() => indexFolders(folders).childrenByParent, [folders]);

  // Offline projects (docs/specs/006-project/offline-mode.md) stay out of the My Work root: they
  // render under the panel's This Browser row instead.
  const projectsByFolder = useMemo(
    () =>
      groupProjectsByFolder(liveDocs, {
        exclude: (d) => d.folderId === null && d.ownerId === OFFLINE_OWNER_ID,
      }),
    [liveDocs],
  );

  // Offline projects (docs/specs/006-project/offline-mode.md): everything saved only in this browser,
  // regardless of any folder placement in the local record, for the panel's
  // This Browser row (mirrors the /explorer route).
  const offlineProjects = useMemo(
    () =>
      liveDocs.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  return {
    current,
    currentTeam,
    currentShared,
    foldersByTeam,
    projectsByTeam,
    foldersByParent,
    projectsByFolder,
    offlineProjects,
  };
}
