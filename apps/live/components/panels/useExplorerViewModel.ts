import { useMemo } from 'react';

import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { groupBy, groupDocumentsByFolder, indexFolders } from '@/lib/folder-tree';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { ExplorerProps } from './Explorer.types';

type ExplorerViewModelDeps = Pick<
  ExplorerProps,
  'documents' | 'folders' | 'currentDocumentId' | 'shared' | 'teamFolders' | 'teamDocuments'
> & {
  deletedTeamIds: Set<string>;
  // Documents this user hid from Recent (docs/specs/013-workspace/hide-from-recent.md). Recent only — every
  // other section of the panel still lists them.
  recentExcludedIds: string[];
};

// Derives the Explorer panel's view-model from the raw document / folder / team
// / shared inputs: the current document (resolved across personal, team, and
// shared sources), the recents list, and the by-folder / by-team / by-parent
// groupings the accordion renders. Pure memoised derivation, split out of
// Explorer so the component is left with wiring + render.
export function useExplorerViewModel({
  documents: liveDocs,
  folders,
  currentDocumentId,
  shared = [],
  teamFolders = [],
  teamDocuments = [],
  deletedTeamIds,
  recentExcludedIds,
}: ExplorerViewModelDeps) {
  const current = useMemo(
    () => (currentDocumentId ? (liveDocs.find((d) => d.id === currentDocumentId) ?? null) : null),
    [liveDocs, currentDocumentId],
  );
  // Team rows minus any the viewer just deleted (see deletedTeamIds).
  const visibleTeamDocuments = useMemo(
    () =>
      deletedTeamIds.size === 0
        ? teamDocuments
        : teamDocuments.filter((d) => !deletedTeamIds.has(d.id)),
    [teamDocuments, deletedTeamIds],
  );
  // When the open document lives in a team library it won't be in
  // `documents` (those are personal only). Fall back to the swept team
  // documents so the Current Document section renders for team documents.
  const currentTeam = useMemo(
    () =>
      !current && currentDocumentId
        ? (visibleTeamDocuments.find((d) => d.id === currentDocumentId) ?? null)
        : null,
    [current, visibleTeamDocuments, currentDocumentId],
  );
  // When the open document is shared (not owned / not team), it won't
  // appear in `documents` either. Fall back to the shared list so the
  // Current Document section still renders for visitors.
  const currentShared = useMemo(
    () =>
      !current && !currentTeam && currentDocumentId
        ? (shared.find((s) => s.id === currentDocumentId) ?? null)
        : null,
    [current, currentTeam, shared, currentDocumentId],
  );
  // Cap the recents list at 5 so the accordion stays compact.
  const RECENT_LIMIT = 5;
  // Recent mirrors the /explorer page (docs/specs/013-workspace/team-shared-documents.md): personal + team +
  // shared documents, interleaved by recency, the current one excluded.
  // Tagged so the render picks the right row component per source.
  const recentExcluded = useMemo(() => new Set(recentExcludedIds), [recentExcludedIds]);
  const recents = useMemo(() => {
    type RecentEntry =
      | {
          kind: 'own' | 'team';
          savedAt: number;
          d: DocumentListItem & { team?: { id: string; name: string } };
        }
      | { kind: 'shared'; savedAt: number; s: SharedWithItem };
    // Hidden-from-Recent (docs/specs/013-workspace/hide-from-recent.md) drops out alongside the currently-open
    // document, and BEFORE the cap, so hiding one promotes the next in.
    const keep = (id: string) => id !== currentDocumentId && !recentExcluded.has(id);
    const own: RecentEntry[] = liveDocs
      .filter((d) => keep(d.id))
      .map((d) => ({ kind: 'own', savedAt: d.savedAt, d }));
    const team: RecentEntry[] = visibleTeamDocuments
      .filter((d) => keep(d.id))
      .map((d) => ({ kind: 'team', savedAt: d.savedAt, d }));
    const sharedEntries: RecentEntry[] = shared
      .filter((s) => keep(s.id))
      .map((s) => ({ kind: 'shared', savedAt: s.savedAt, s }));
    return [...own, ...team, ...sharedEntries]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, RECENT_LIMIT);
  }, [liveDocs, visibleTeamDocuments, shared, currentDocumentId, recentExcluded]);
  // This team's folder rows and documents, indexed by team, for the Teams
  // accordion, which shows the documents inside each team folder (docs/specs/013-workspace/team-shared-documents.md).
  const foldersByTeam = useMemo(() => groupBy(teamFolders, (f) => f.teamId), [teamFolders]);
  const documentsByTeam = useMemo(
    () => groupBy(visibleTeamDocuments, (d) => d.team.id),
    [visibleTeamDocuments],
  );

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = useMemo(() => indexFolders(folders).childrenByParent, [folders]);

  // Offline documents (docs/specs/006-document/offline-mode.md) stay out of the root Unsorted bucket: they
  // render under the panel's synthetic Offline node instead.
  const documentsByFolder = useMemo(
    () =>
      groupDocumentsByFolder(liveDocs, {
        exclude: (d) => d.folderId === null && d.ownerId === OFFLINE_OWNER_ID,
      }),
    [liveDocs],
  );

  // Offline documents (docs/specs/006-document/offline-mode.md): everything saved only in this browser,
  // regardless of any folder placement in the local record, for the panel's
  // always-shown synthetic Offline node (mirrors the /explorer route).
  const offlineDocuments = useMemo(
    () =>
      liveDocs.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  return {
    current,
    currentTeam,
    currentShared,
    recents,
    foldersByTeam,
    documentsByTeam,
    foldersByParent,
    documentsByFolder,
    offlineDocuments,
  };
}
