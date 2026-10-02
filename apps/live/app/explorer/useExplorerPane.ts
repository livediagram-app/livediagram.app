'use client';

import { useMemo } from 'react';
import { VIEW_TITLES } from './view-titles';
import type { DocumentListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { groupDocumentsByFolder } from '@/lib/folder-tree';
import type { TeamDocumentRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import { sharedToPaneDocument, type PaneDocument, type SelectedNode } from './views';

// "Recent" cap. Big enough for "what was I just working on",
// small enough that it doesn't drown the list view.
const RECENT_LIMIT = 12;

// The right-pane derivations (docs/specs/013-workspace/folders.md), lifted out of useExplorerState:
// everything the pane shows for the current selection — the per-folder
// document buckets, the synthetic Unsorted / Generated folders, the pane
// content / title / breadcrumb, and the sidebar's Recent badge count.
// Pure memos over the state the orchestration hook owns and passes in.
export function useExplorerPane({
  selected,
  documents: liveDocs,
  teamDocuments,
  shared,
  childrenByParent,
  folderById,
  teams,
  breadcrumb,
  go,
  recentExcludedIds,
  favouriteIds,
}: {
  selected: SelectedNode;
  documents: DocumentListItem[];
  teamDocuments: TeamDocumentRow[];
  shared: SharedWithItem[];
  childrenByParent: Map<string | null, Folder[]>;
  folderById: Map<string, Folder>;
  teams: { id: string; name: string }[];
  breadcrumb: (folderId: string | null) => Folder[];
  go: (sel: SelectedNode) => void;
  // Documents this user hid from Recent (docs/specs/013-workspace/hide-from-recent.md). Only Recent honours it;
  // every other pane still lists them normally.
  recentExcludedIds: string[];
  // Documents this user starred (docs/specs/013-workspace/favourites.md). Spans personal AND team rows,
  // which is why the Favourites branch below reads both lists.
  favouriteIds: Set<string>;
}) {
  const documentsByFolder = useMemo(() => groupDocumentsByFolder(liveDocs), [liveDocs]);

  // Unsorted is a virtual folder backed by `folder_id IS NULL` —
  // not a row in the folders table, just a synthetic bucket so loose
  // documents have somewhere obvious to live (docs/specs/013-workspace/folders.md). Cached so the
  // sidebar + the "All documents" list row both reference the same
  // count without re-filtering.
  const unsortedDocuments = useMemo(
    () =>
      liveDocs
        // Generated documents (source != null) live in their own synthetic
        // "Generated" folder, not Unsorted, and offline documents (docs/specs/006-document/offline-mode.md)
        // in the synthetic "Offline" folder, so the buckets don't overlap.
        .filter((d) => d.folderId === null && !d.source && d.ownerId !== OFFLINE_OWNER_ID)
        .sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  // Generated documents (docs/specs/013-workspace/folders.md): the synthetic folder for AI-made documents
  // (source != null) that the user hasn't filed yet. Mirrors Unsorted
  // (folder_id null), so filing a generated document into a folder of your
  // own moves it out of Generated, just like Unsorted; the two synthetic
  // buckets stay mutually exclusive (Unsorted excludes source != null).
  const generatedDocuments = useMemo(
    () =>
      liveDocs
        .filter((d) => d.source != null && d.folderId === null)
        .sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  // Offline documents (docs/specs/006-document/offline-mode.md): the synthetic folder for browser-only
  // documents. A dynamic view over EVERYTHING offline (regardless of any
  // folder placement stored in the local record), so the one place to find
  // every document that exists only in this browser.
  const offlineDocuments = useMemo(
    () =>
      liveDocs.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [liveDocs],
  );

  // What to show in the right pane for the current selection.
  // - `recent`: last N owned documents (no folders).
  // - `shared` / `gallery` / `team` / `invites`: dedicated panes.
  // - `all`: root user folders + the synthetic Unsorted bucket as a
  //   leading row when there are unsorted documents.
  // - `unsorted`: just documents with folderId === null.
  // - `folder`: direct subfolders + direct documents in that folder.
  // Set for O(1) lookups in the two memos below.
  const excluded = useMemo(() => new Set(recentExcludedIds), [recentExcludedIds]);

  const paneContent = useMemo<{
    showUnsortedRow: boolean;
    folders: Folder[];
    documents: PaneDocument[];
  }>(() => {
    if (selected.kind === 'recent') {
      // Recent spans the personal library, every joined team's shared
      // documents (docs/specs/013-workspace/team-shared-documents.md), AND documents shared with you — interleaved
      // by recency. Team rows carry their team (badge + owner column);
      // shared rows carry the sharer + share code so the row links via
      // the share link and shows the "Shared" badge.
      const sharedRows: PaneDocument[] = shared.map(sharedToPaneDocument);
      const sorted = [...liveDocs, ...teamDocuments, ...sharedRows]
        // Hidden-from-Recent (docs/specs/013-workspace/hide-from-recent.md). Filtered BEFORE the cap so hiding
        // one document promotes the next one in rather than leaving a gap.
        .filter((d) => !excluded.has(d.id))
        .sort((a, b) => b.savedAt - a.savedAt);
      return { showUnsortedRow: false, folders: [], documents: sorted.slice(0, RECENT_LIMIT) };
    }
    if (
      selected.kind === 'timeline' ||
      selected.kind === 'activity' ||
      selected.kind === 'shared' ||
      selected.kind === 'gallery' ||
      selected.kind === 'themes' ||
      selected.kind === 'shape-libraries' ||
      selected.kind === 'trash' ||
      selected.kind === 'team' ||
      selected.kind === 'invites'
    ) {
      return { showUnsortedRow: false, folders: [], documents: [] };
    }
    if (selected.kind === 'unsorted') {
      return { showUnsortedRow: false, folders: [], documents: unsortedDocuments };
    }
    if (selected.kind === 'favourites') {
      // Aggregates across personal AND team libraries: a star is about the
      // document, not where it happens to live (docs/specs/013-workspace/favourites.md). Shared-with-you
      // rows are excluded — you can't star what isn't in your library.
      //
      // Ordering matches every other pane (most recently updated first)
      // rather than "when I starred it", so there's nothing new to learn;
      // the source chip tells you which team each one came from.
      const starred = [...liveDocs, ...teamDocuments].filter((d) => favouriteIds.has(d.id));
      return {
        showUnsortedRow: false,
        folders: [],
        documents: starred.sort((a, b) => b.savedAt - a.savedAt),
      };
    }
    if (selected.kind === 'generated') {
      return { showUnsortedRow: false, folders: [], documents: generatedDocuments };
    }
    if (selected.kind === 'offline') {
      return { showUnsortedRow: false, folders: [], documents: offlineDocuments };
    }
    // The Dynamic parent (and the All list's single Dynamic row) carry no
    // folders/documents of their own; ExplorerPane derives the synthetic
    // rows to show from selected.kind.
    if (selected.kind === 'dynamic') {
      return { showUnsortedRow: false, folders: [], documents: [] };
    }
    if (selected.kind === 'all') {
      return {
        showUnsortedRow: false,
        folders: childrenByParent.get(null) ?? [],
        documents: [],
      };
    }
    return {
      showUnsortedRow: false,
      folders: childrenByParent.get(selected.id) ?? [],
      documents: documentsByFolder.get(selected.id) ?? [],
    };
  }, [
    selected,
    liveDocs,
    teamDocuments,
    shared,
    childrenByParent,
    documentsByFolder,
    unsortedDocuments,
    generatedDocuments,
    offlineDocuments,
    excluded,
    favouriteIds,
  ]);

  // Count for the sidebar "Recent documents" badge (docs/specs/013-workspace/team-shared-documents.md), mirroring
  // "Shared with me": how many items the Recent list holds, capped.
  const recentCount = useMemo(() => {
    // Counts what Recent will actually SHOW, so the badge can't promise
    // rows the pane then filters out (docs/specs/013-workspace/hide-from-recent.md).
    const visible =
      liveDocs.filter((d) => !excluded.has(d.id)).length +
      teamDocuments.filter((d) => !excluded.has(d.id)).length +
      shared.filter((s) => !excluded.has(s.id)).length;
    return Math.min(RECENT_LIMIT, visible);
  }, [liveDocs, teamDocuments, shared, excluded]);

  // Each view is named by its sidebar row (VIEW_TITLES); a folder or team by its own name.
  const paneTitle = useMemo(() => {
    if (selected.kind === 'team') return teams.find((t) => t.id === selected.id)?.name ?? 'Team';
    if (selected.kind === 'folder') return folderById.get(selected.id)?.name ?? 'Folder';
    return VIEW_TITLES[selected.kind];
  }, [selected, folderById, teams]);

  // Breadcrumb segments for the pane header, following the sidebar's rows. Each segment carries
  // an optional onClick — the leaf (current selection) is plain text so the user can't navigate
  // to where they already are. Unsorted, Generated and the folders sit under My documents; every
  // other view is a top-level row (or has none) and its trail is a single leaf.
  type Crumb = { name: string; onClick?: () => void };
  const paneCrumbs = useMemo<Crumb[]>(() => {
    const all: Crumb = { name: VIEW_TITLES.all, onClick: () => go({ kind: 'all' }) };
    if (
      selected.kind === 'unsorted' ||
      selected.kind === 'generated' ||
      selected.kind === 'dynamic'
    )
      return [all, { name: VIEW_TITLES[selected.kind] }];
    if (selected.kind !== 'folder') return [{ name: paneTitle }];
    const chain = breadcrumb(selected.id);
    return [
      all,
      ...chain.slice(0, -1).map((c) => ({
        name: c.name,
        onClick: () => go({ kind: 'folder', id: c.id }),
      })),
      { name: chain[chain.length - 1]?.name ?? 'Folder' },
    ];
  }, [selected, paneTitle, breadcrumb, go]);

  return {
    documentsByFolder,
    unsortedDocuments,
    generatedDocuments,
    offlineDocuments,
    paneContent,
    recentCount,
    paneTitle,
    paneCrumbs,
  };
}
