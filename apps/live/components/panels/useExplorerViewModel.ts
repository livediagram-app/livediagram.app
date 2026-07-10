import { useMemo } from 'react';

import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { ExplorerProps } from './Explorer.types';

type ExplorerViewModelDeps = Pick<
  ExplorerProps,
  'diagrams' | 'folders' | 'currentDiagramId' | 'shared' | 'teamFolders' | 'teamDiagrams'
> & { deletedTeamIds: Set<string> };

// Derives the Explorer panel's view-model from the raw diagram / folder / team
// / shared inputs: the current diagram (resolved across personal, team, and
// shared sources), the recents list, and the by-folder / by-team / by-parent
// groupings the accordion renders. Pure memoised derivation, split out of
// Explorer so the component is left with wiring + render.
export function useExplorerViewModel({
  diagrams,
  folders,
  currentDiagramId,
  shared = [],
  teamFolders = [],
  teamDiagrams = [],
  deletedTeamIds,
}: ExplorerViewModelDeps) {
  const current = useMemo(
    () => (currentDiagramId ? (diagrams.find((d) => d.id === currentDiagramId) ?? null) : null),
    [diagrams, currentDiagramId],
  );
  // Team rows minus any the viewer just deleted (see deletedTeamIds).
  const visibleTeamDiagrams = useMemo(
    () =>
      deletedTeamIds.size === 0
        ? teamDiagrams
        : teamDiagrams.filter((d) => !deletedTeamIds.has(d.id)),
    [teamDiagrams, deletedTeamIds],
  );
  // When the open diagram lives in a team library it won't be in
  // `diagrams` (those are personal only). Fall back to the swept team
  // diagrams so the Current Diagram section renders for team diagrams.
  const currentTeam = useMemo(
    () =>
      !current && currentDiagramId
        ? (visibleTeamDiagrams.find((d) => d.id === currentDiagramId) ?? null)
        : null,
    [current, visibleTeamDiagrams, currentDiagramId],
  );
  // When the open diagram is shared (not owned / not team), it won't
  // appear in `diagrams` either. Fall back to the shared list so the
  // Current Diagram section still renders for visitors.
  const currentShared = useMemo(
    () =>
      !current && !currentTeam && currentDiagramId
        ? (shared.find((s) => s.id === currentDiagramId) ?? null)
        : null,
    [current, currentTeam, shared, currentDiagramId],
  );
  // Cap the recents list at 5 so the accordion stays compact.
  const RECENT_LIMIT = 5;
  // Recent mirrors the /explorer page (spec/35): personal + team +
  // shared diagrams, interleaved by recency, the current one excluded.
  // Tagged so the render picks the right row component per source.
  const recents = useMemo(() => {
    type RecentEntry =
      | {
          kind: 'own' | 'team';
          savedAt: number;
          d: DiagramListItem & { team?: { id: string; name: string } };
        }
      | { kind: 'shared'; savedAt: number; s: SharedWithItem };
    const own: RecentEntry[] = diagrams
      .filter((d) => d.id !== currentDiagramId)
      .map((d) => ({ kind: 'own', savedAt: d.savedAt, d }));
    const team: RecentEntry[] = visibleTeamDiagrams
      .filter((d) => d.id !== currentDiagramId)
      .map((d) => ({ kind: 'team', savedAt: d.savedAt, d }));
    const sharedEntries: RecentEntry[] = shared
      .filter((s) => s.id !== currentDiagramId)
      .map((s) => ({ kind: 'shared', savedAt: s.savedAt, s }));
    return [...own, ...team, ...sharedEntries]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, RECENT_LIMIT);
  }, [diagrams, visibleTeamDiagrams, shared, currentDiagramId]);
  // This team's folder rows, indexed by team, for the Teams accordion.
  const foldersByTeam = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parentId: string | null }[]>();
    for (const f of teamFolders) {
      const bucket = map.get(f.teamId) ?? [];
      bucket.push({ id: f.id, name: f.name, parentId: f.parentId });
      map.set(f.teamId, bucket);
    }
    return map;
  }, [teamFolders]);
  // This team's diagrams, indexed by team, so the Teams accordion can
  // show the diagrams inside each team folder (spec/35).
  const diagramsByTeam = useMemo(() => {
    const map = new Map<string, DiagramListItem[]>();
    for (const d of visibleTeamDiagrams) {
      const bucket = map.get(d.team.id) ?? [];
      bucket.push(d);
      map.set(d.team.id, bucket);
    }
    return map;
  }, [visibleTeamDiagrams]);

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const bucket = map.get(f.parentId) ?? [];
      bucket.push(f);
      map.set(f.parentId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  const diagramsByFolder = useMemo(() => {
    const map = new Map<string | null, DiagramListItem[]>();
    for (const d of diagrams) {
      // Offline diagrams (spec/76) stay out of the root Unsorted bucket:
      // they render under the panel's synthetic Offline node instead.
      if (d.folderId === null && d.ownerId === OFFLINE_OWNER_ID) continue;
      const bucket = map.get(d.folderId) ?? [];
      bucket.push(d);
      map.set(d.folderId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return map;
  }, [diagrams]);

  // Offline diagrams (spec/76): everything saved only in this browser,
  // regardless of any folder placement in the local record, for the panel's
  // always-shown synthetic Offline node (mirrors the /explorer route).
  const offlineDiagrams = useMemo(
    () =>
      diagrams.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [diagrams],
  );

  return {
    current,
    currentTeam,
    currentShared,
    recents,
    foldersByTeam,
    diagramsByTeam,
    foldersByParent,
    diagramsByFolder,
    offlineDiagrams,
  };
}
