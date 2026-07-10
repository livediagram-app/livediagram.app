'use client';

import { useMemo } from 'react';
import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { TeamDiagramRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import type { PaneDiagram, SelectedNode } from './views';

// "Recent" cap. Big enough for "what was I just working on",
// small enough that it doesn't drown the list view.
const RECENT_LIMIT = 12;

// The right-pane derivations (spec/15), lifted out of useExplorerState:
// everything the pane shows for the current selection — the per-folder
// diagram buckets, the synthetic Unsorted / Generated folders, the pane
// content / title / breadcrumb, and the sidebar's Recent badge count.
// Pure memos over the state the orchestration hook owns and passes in.
export function useExplorerPane({
  selected,
  diagrams,
  teamDiagrams,
  shared,
  childrenByParent,
  folderById,
  teams,
  breadcrumb,
  go,
}: {
  selected: SelectedNode;
  diagrams: DiagramListItem[];
  teamDiagrams: TeamDiagramRow[];
  shared: SharedWithItem[];
  childrenByParent: Map<string | null, Folder[]>;
  folderById: Map<string, Folder>;
  teams: { id: string; name: string }[];
  breadcrumb: (folderId: string | null) => Folder[];
  go: (sel: SelectedNode) => void;
}) {
  const diagramsByFolder = useMemo(() => {
    const m = new Map<string | null, DiagramListItem[]>();
    for (const d of diagrams) {
      const bucket = m.get(d.folderId) ?? [];
      bucket.push(d);
      m.set(d.folderId, bucket);
    }
    for (const bucket of m.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return m;
  }, [diagrams]);

  // Unsorted is a virtual folder backed by `folder_id IS NULL` —
  // not a row in the folders table, just a synthetic bucket so loose
  // diagrams have somewhere obvious to live (spec/15). Cached so the
  // sidebar + the "All diagrams" list row both reference the same
  // count without re-filtering.
  const unsortedDiagrams = useMemo(
    () =>
      diagrams
        // Generated diagrams (source != null) live in their own synthetic
        // "Generated" folder, not Unsorted, and offline diagrams (spec/76)
        // in the synthetic "Offline" folder, so the buckets don't overlap.
        .filter((d) => d.folderId === null && !d.source && d.ownerId !== OFFLINE_OWNER_ID)
        .sort((a, b) => b.savedAt - a.savedAt),
    [diagrams],
  );

  // Generated diagrams (spec/15): the synthetic folder for AI-made diagrams
  // (source != null) that the user hasn't filed yet. Mirrors Unsorted
  // (folder_id null), so filing a generated diagram into a folder of your
  // own moves it out of Generated, just like Unsorted; the two synthetic
  // buckets stay mutually exclusive (Unsorted excludes source != null).
  const generatedDiagrams = useMemo(
    () =>
      diagrams
        .filter((d) => d.source != null && d.folderId === null)
        .sort((a, b) => b.savedAt - a.savedAt),
    [diagrams],
  );

  // Offline diagrams (spec/76): the synthetic folder for browser-only
  // diagrams. A dynamic view over EVERYTHING offline (regardless of any
  // folder placement stored in the local record), so the one place to find
  // every diagram that exists only in this browser.
  const offlineDiagrams = useMemo(
    () =>
      diagrams.filter((d) => d.ownerId === OFFLINE_OWNER_ID).sort((a, b) => b.savedAt - a.savedAt),
    [diagrams],
  );

  // What to show in the right pane for the current selection.
  // - `recent`: last N owned diagrams (no folders).
  // - `shared` / `gallery` / `team` / `invites`: dedicated panes.
  // - `all`: root user folders + the synthetic Unsorted bucket as a
  //   leading row when there are unsorted diagrams.
  // - `unsorted`: just diagrams with folderId === null.
  // - `folder`: direct subfolders + direct diagrams in that folder.
  const paneContent = useMemo<{
    showUnsortedRow: boolean;
    folders: Folder[];
    diagrams: PaneDiagram[];
  }>(() => {
    if (selected.kind === 'recent') {
      // Recent spans the personal library, every joined team's shared
      // diagrams (spec/35), AND diagrams shared with you — interleaved
      // by recency. Team rows carry their team (badge + owner column);
      // shared rows carry the sharer + share code so the row links via
      // the share link and shows the "Shared" badge.
      const sharedRows: PaneDiagram[] = shared.map((s) => ({
        id: s.id,
        name: s.name,
        folderId: null,
        savedAt: s.savedAt,
        shareCode: s.shareCode,
        ownerId: '',
        shared: { ownerName: s.ownerName, role: s.role, shareCode: s.shareCode },
      }));
      const sorted = [...diagrams, ...teamDiagrams, ...sharedRows].sort(
        (a, b) => b.savedAt - a.savedAt,
      );
      return { showUnsortedRow: false, folders: [], diagrams: sorted.slice(0, RECENT_LIMIT) };
    }
    if (
      selected.kind === 'shared' ||
      selected.kind === 'gallery' ||
      selected.kind === 'themes' ||
      selected.kind === 'tokens' ||
      selected.kind === 'profile' ||
      selected.kind === 'team' ||
      selected.kind === 'invites'
    ) {
      return { showUnsortedRow: false, folders: [], diagrams: [] };
    }
    if (selected.kind === 'unsorted') {
      return { showUnsortedRow: false, folders: [], diagrams: unsortedDiagrams };
    }
    if (selected.kind === 'generated') {
      return { showUnsortedRow: false, folders: [], diagrams: generatedDiagrams };
    }
    if (selected.kind === 'offline') {
      return { showUnsortedRow: false, folders: [], diagrams: offlineDiagrams };
    }
    // The Dynamic parent (and the All list's single Dynamic row) carry no
    // folders/diagrams of their own; ExplorerPane derives the synthetic
    // rows to show from selected.kind.
    if (selected.kind === 'dynamic') {
      return { showUnsortedRow: false, folders: [], diagrams: [] };
    }
    if (selected.kind === 'all') {
      return {
        showUnsortedRow: false,
        folders: childrenByParent.get(null) ?? [],
        diagrams: [],
      };
    }
    return {
      showUnsortedRow: false,
      folders: childrenByParent.get(selected.id) ?? [],
      diagrams: diagramsByFolder.get(selected.id) ?? [],
    };
  }, [
    selected,
    diagrams,
    teamDiagrams,
    shared,
    childrenByParent,
    diagramsByFolder,
    unsortedDiagrams,
    generatedDiagrams,
    offlineDiagrams,
  ]);

  // Count for the sidebar "Recent diagrams" badge (spec/35), mirroring
  // "Shared with me": how many items the Recent list holds, capped.
  const recentCount = useMemo(
    () => Math.min(RECENT_LIMIT, diagrams.length + teamDiagrams.length + shared.length),
    [diagrams, teamDiagrams, shared],
  );

  const paneTitle = useMemo(() => {
    if (selected.kind === 'recent') return 'Recent';
    if (selected.kind === 'shared') return 'Shared with you';
    if (selected.kind === 'gallery') return 'Image gallery';
    if (selected.kind === 'themes') return 'Themes';
    if (selected.kind === 'tokens') return 'API tokens';
    if (selected.kind === 'profile') return 'Profile';
    if (selected.kind === 'team') {
      return teams.find((t) => t.id === selected.id)?.name ?? 'Team';
    }
    if (selected.kind === 'invites') return 'Invites';
    if (selected.kind === 'all') return 'My Work';
    if (selected.kind === 'unsorted') return 'Unsorted';
    if (selected.kind === 'generated') return 'Generated';
    if (selected.kind === 'offline') return 'Offline';
    if (selected.kind === 'dynamic') return 'Dynamic';
    return folderById.get(selected.id)?.name ?? 'Folder';
  }, [selected, folderById, teams]);

  // Breadcrumb segments for the pane header. Each segment carries
  // an optional onClick — the leaf (current selection) is plain
  // text so the user can't navigate to where they already are.
  type Crumb = { name: string; onClick?: () => void };
  const paneCrumbs = useMemo<Crumb[]>(() => {
    const all: Crumb = { name: 'My Work', onClick: () => go({ kind: 'all' }) };
    if (selected.kind === 'recent') return [{ name: 'Recent' }];
    if (selected.kind === 'shared') return [{ name: 'Shared with you' }];
    if (selected.kind === 'gallery') return [{ name: 'Image gallery' }];
    if (selected.kind === 'themes') return [{ name: 'Themes' }];
    if (selected.kind === 'tokens') return [{ name: 'API tokens' }];
    if (selected.kind === 'profile') return [{ name: 'Profile' }];
    if (selected.kind === 'team') return [{ name: paneTitle }];
    if (selected.kind === 'invites') return [{ name: 'Invites' }];
    if (selected.kind === 'all') return [{ name: 'My Work' }];
    const dynamic: Crumb = { name: 'Dynamic', onClick: () => go({ kind: 'dynamic' }) };
    if (selected.kind === 'dynamic') return [all, { name: 'Dynamic' }];
    if (selected.kind === 'unsorted') return [all, dynamic, { name: 'Unsorted' }];
    if (selected.kind === 'generated') return [all, dynamic, { name: 'Generated' }];
    if (selected.kind === 'offline') return [all, dynamic, { name: 'Offline' }];
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
    diagramsByFolder,
    unsortedDiagrams,
    generatedDiagrams,
    offlineDiagrams,
    paneContent,
    recentCount,
    paneTitle,
    paneCrumbs,
  };
}
