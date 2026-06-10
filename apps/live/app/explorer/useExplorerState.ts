'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiListDiagrams,
  apiListSharedWith,
  apiSetDiagramFolder,
  apiUpdateFolder,
  type DiagramListItem,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { ensureGuestSelfId } from '@/lib/local-identity';
import { track } from '@/lib/telemetry';
import { useFolders } from '@/hooks/useFolders';
import { useTeamLibrariesSweep } from '@/hooks/useTeamLibrariesSweep';
import { useTeams } from '@/hooks/useTeams';
import { useConfirm } from '@/hooks/useConfirm';
import { useDiagramListActions } from '@/hooks/useDiagramListActions';
import { explorerPathFor, selectedFromRoute } from './routes';
import type { SelectedNode } from './views';

// "Recent" cap. Big enough for "what was I just working on",
// small enough that it doesn't drown the list view.
const RECENT_LIMIT = 12;

// All Explorer state + handlers, lifted out of the old single-page
// component when the sections became routes (spec/15): the layout's
// ExplorerShell instantiates this once and provides it via
// ExplorerContext, so the sidebar persists (data and all) while the
// child route under /explorer/<section> changes. The current section
// is no longer useState — it's derived from the URL, and `go`
// navigates, so back/forward and deep links work for free.
//
// Open to both guests and signed-in users (spec/04 + spec/15): the
// owner id resolves to the Clerk userId when signed in, otherwise to
// the `livediagram:v2:self-id` localStorage UUID.
export function useExplorerState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // What the tree highlights + the right pane shows, derived from the
  // address bar (routes.ts). /explorer itself redirects to /recent.
  const selected = useMemo<SelectedNode>(
    () => selectedFromRoute(pathname ?? '/explorer/recent', searchParams),
    [pathname, searchParams],
  );

  const { authLoaded, clerkUserId, clerkDisplayName, isSignedIn } = useClerkApiBootstrap();
  // Owner id resolution mirrors new/page.tsx + editor-page.tsx: a
  // signed-in user is keyed by Clerk userId, a guest is keyed by the
  // localStorage UUID (minted on first visit). Null until Clerk has
  // settled so a signed-in user never momentarily reads a guest id.
  const ownerId: string | null = useMemo(() => {
    if (!authLoaded) return null;
    return clerkUserId ?? ensureGuestSelfId();
  }, [authLoaded, clerkUserId]);
  const [diagrams, setDiagrams] = useState<DiagramListItem[]>([]);
  const {
    folders,
    createFolder: hookCreateFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders(ownerId, { autoLoad: false });
  const [shared, setShared] = useState<SharedWithItem[]>([]);
  // Teams (spec/32): signed-in only. Guests get a sign-in prompt in
  // the sidebar section instead of rows; Clerk-disabled self-host
  // deployments hide the section entirely.
  const teamsEnabled = Boolean(isSignedIn && clerkUserId);
  const {
    teams,
    invites,
    createTeam: hookCreateTeam,
    acceptInvite,
    declineInvite,
    refresh: refreshTeams,
  } = useTeams(ownerId, { enabled: teamsEnabled });
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Folder id mid-rename so the tree / list row swaps to an input
  // until the user commits or escapes.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // Diagram id mid-rename. Same pattern as folders.
  const [renamingDiagramId, setRenamingDiagramId] = useState<string | null>(null);
  // Move picker target. The picker uses moveAnchorRef for placement.
  // `kind` discriminates whether we're moving a diagram or a folder
  // so the picker can filter (a folder can't be moved into itself
  // or its descendants — the server cycle-checks but the picker
  // hides those rows up-front to make the rejection less surprising).
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'diagram'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Team libraries swept lazily (spec/35) for the three consumers:
  // the search panel's Folders group, the move modal's team
  // destinations, and the Recent list's team rows. Recent is the
  // landing section, so signed-in members effectively sweep on
  // arrival; guests (no teams) never fetch.
  const { teamFolders, teamDiagrams } = useTeamLibrariesSweep(ownerId, teams, {
    enabled: searchOpen || moveTarget?.kind === 'diagram' || selected.kind === 'recent',
  });
  // Mobile section drawer: the sidebar is hidden below `sm`, so on a
  // phone this slides it in from a hamburger in the pane header.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Navigate to a section's route and close the mobile drawer (a
  // no-op on desktop where it's never open). Used by every sidebar
  // row so picking a section on a phone returns you to the content.
  const go = useCallback(
    (node: SelectedNode) => {
      router.push(explorerPathFor(node));
      setMobileNavOpen(false);
    },
    [router],
  );
  const confirm = useConfirm();
  // Which folder branches are open in the sidebar. Local state only;
  // a fresh visit starts with the root open and everything else
  // collapsed (Windows Explorer pattern).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());

  const refresh = useCallback(
    async (ownerId: string) => {
      setLoading(true);
      const [list, sharedList] = await Promise.all([
        apiListDiagrams(ownerId).catch(() => null),
        apiListSharedWith(ownerId).catch(() => null),
        refreshFolders(),
      ]);
      setDiagrams(list ?? []);
      setShared(sharedList ?? []);
      setLoading(false);
    },
    [refreshFolders],
  );

  useEffect(() => {
    if (!authLoaded) return;
    if (!ownerId) {
      setLoading(false);
      return;
    }
    void refresh(ownerId);
  }, [authLoaded, ownerId, refresh]);

  // ---- Derived tree shape ---------------------------------------
  // Index folders by parentId so the recursive renderer can walk
  // children in O(1) per node, and by id so breadcrumb-from-id can
  // walk parents without re-scanning the list.
  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    const byId = new Map<string, Folder>();
    const byParent = new Map<string | null, Folder[]>();
    for (const f of folders) {
      byId.set(f.id, f);
      const bucket = byParent.get(f.parentId) ?? [];
      bucket.push(f);
      byParent.set(f.parentId, bucket);
    }
    for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return {
      folderById: byId,
      childrenByParent: byParent,
      rootFolders: byParent.get(null) ?? [],
    };
  }, [folders]);

  // Build a breadcrumb path from root → folderId, used both by the
  // header and the move-picker rows. Tolerant of dangling parentIds
  // (which can happen mid-refresh between an optimistic delete and
  // the server response). Returns [] for `all` / virtual nodes.
  const breadcrumb = useCallback(
    (folderId: string | null): Folder[] => {
      if (!folderId) return [];
      const chain: Folder[] = [];
      let cursor: Folder | undefined = folderById.get(folderId);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        chain.unshift(cursor);
        cursor = cursor.parentId ? folderById.get(cursor.parentId) : undefined;
      }
      return chain;
    },
    [folderById],
  );

  // Set of folder ids that are descendants of (or equal to) the
  // given root. Used to hide a folder + its subtree from the
  // move-picker — moving a folder into its own descendant would
  // be a cycle (server rejects, but pre-filtering keeps the UI
  // honest).
  const descendantSet = useCallback(
    (rootId: string): Set<string> => {
      const out = new Set<string>([rootId]);
      const stack = [rootId];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const kids = childrenByParent.get(cur) ?? [];
        for (const k of kids)
          if (!out.has(k.id)) {
            out.add(k.id);
            stack.push(k.id);
          }
      }
      return out;
    },
    [childrenByParent],
  );

  // ---- Mutations -----------------------------------------------
  // Wrapper around the hook's create that drops the user into
  // rename mode on the new stub, optionally nesting it under a
  // parent. Used by both the pane-header CTA (parentId=null) and the
  // tree / list "New subfolder" actions (parentId=<current folder>).
  const createFolder = async (parentId: string | null) => {
    const created = await hookCreateFolder({ parentId });
    if (created) {
      setRenamingFolderId(created.id);
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    }
  };

  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    renameFolder(id, name);
  };

  // Move a folder under a new parent. Used by the picker. The hook
  // doesn't expose a reparent helper directly because folder moves
  // are rare; we shape the optimistic update locally and fire the
  // API call ourselves.
  const moveFolderToParent = (id: string, parentId: string | null) => {
    if (!ownerId) return;
    // No-op if we'd be moving into ourselves or a descendant — the
    // picker already filters these, this is belt-and-braces.
    if (parentId && descendantSet(id).has(parentId)) return;
    void apiUpdateFolder(ownerId, id, { parentId }).catch(() => {});
    // Folder moves are rare enough that one refresh round-trip is
    // fine (useFolders owns the canonical list).
    void refreshFolders();
    track('Folder', 'Moved');
  };

  // Diagram-row + Shared-row mutations come from the shared
  // useDiagramListActions hook (the same behaviours behind the
  // editor's Explorer panel and /new), so the optimistic updates,
  // API calls, telemetry, and confirm copy stay single-sourced. The
  // hook wraps the rename to also clear its inline-rename state.
  const {
    renameDiagram: listRenameDiagram,
    deleteDiagram,
    deleteFolder: deleteFolderWithCascade,
    moveDiagramToFolder,
    duplicateDiagram,
    dismissSharedDiagram: dismissShared,
  } = useDiagramListActions({
    ownerId,
    diagramList: diagrams,
    setDiagramList: setDiagrams,
    confirm,
    deleteFolderFromHook: deleteFolder,
    // Stay on the library after a duplicate; just refresh the list
    // so the copy's row appears.
    afterDuplicate: async () => {
      if (!ownerId) return;
      const list = await apiListDiagrams(ownerId).catch(() => null);
      if (list) setDiagrams(list);
    },
    sharedDiagrams: shared,
    setSharedDiagrams: setShared,
  });

  const renameDiagram = (id: string, name: string) => {
    setRenamingDiagramId(null);
    listRenameDiagram(id, name);
  };

  // Send one of the caller's own diagrams into a team's shared
  // library (spec/35) — straight into a team folder when the move
  // picker chose one, else the team's Unsorted. Leaves the personal
  // lists either way, so the local row is dropped optimistically.
  const moveDiagramToTeam = (id: string, teamId: string, folderId: string | null = null) => {
    if (!ownerId) return;
    void apiSetDiagramFolder(ownerId, id, folderId, teamId).catch(() => {});
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    track('Team', 'Added', 'Diagram');
  };

  const openMovePickerForDiagram = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTarget({ kind: 'diagram', id });
  };

  const openMovePickerForFolder = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTarget({ kind: 'folder', id });
  };

  // Move picker rows: every folder by breadcrumb path. For a folder
  // move we hide the target's own subtree so cycle-creating choices
  // don't appear. Always-first option: "All diagrams" (= move to
  // root / Unsorted depending on whether the target is a diagram or
  // a folder).
  const movePickerRows = useMemo(() => {
    const excluded =
      moveTarget?.kind === 'folder' ? descendantSet(moveTarget.id) : new Set<string>();
    return folders
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({
        id: f.id,
        path: breadcrumb(f.id)
          .map((p) => p.name)
          .join(' / '),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders, moveTarget, breadcrumb, descendantSet]);

  // ---- Right-pane content --------------------------------------
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
    () => diagrams.filter((d) => d.folderId === null).sort((a, b) => b.savedAt - a.savedAt),
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
    diagrams: (DiagramListItem & { team?: { id: string; name: string } })[];
  }>(() => {
    if (selected.kind === 'recent') {
      // Recent spans the personal library AND every joined team's
      // shared diagrams (spec/35); team rows carry their team for the
      // "Team" badge + owner column.
      const sorted = [...diagrams, ...teamDiagrams].sort((a, b) => b.savedAt - a.savedAt);
      return { showUnsortedRow: false, folders: [], diagrams: sorted.slice(0, RECENT_LIMIT) };
    }
    if (
      selected.kind === 'shared' ||
      selected.kind === 'gallery' ||
      selected.kind === 'team' ||
      selected.kind === 'invites'
    ) {
      return { showUnsortedRow: false, folders: [], diagrams: [] };
    }
    if (selected.kind === 'unsorted') {
      return { showUnsortedRow: false, folders: [], diagrams: unsortedDiagrams };
    }
    if (selected.kind === 'all') {
      return {
        showUnsortedRow: true,
        folders: childrenByParent.get(null) ?? [],
        diagrams: [],
      };
    }
    return {
      showUnsortedRow: false,
      folders: childrenByParent.get(selected.id) ?? [],
      diagrams: diagramsByFolder.get(selected.id) ?? [],
    };
  }, [selected, diagrams, teamDiagrams, childrenByParent, diagramsByFolder, unsortedDiagrams]);

  const paneTitle = useMemo(() => {
    if (selected.kind === 'recent') return 'Recent diagrams';
    if (selected.kind === 'shared') return 'Shared with me';
    if (selected.kind === 'gallery') return 'Image gallery';
    if (selected.kind === 'team') {
      return teams.find((t) => t.id === selected.id)?.name ?? 'Team';
    }
    if (selected.kind === 'invites') return 'Invites';
    if (selected.kind === 'all') return 'All diagrams';
    if (selected.kind === 'unsorted') return 'Unsorted';
    return folderById.get(selected.id)?.name ?? 'Folder';
  }, [selected, folderById, teams]);

  // Breadcrumb segments for the pane header. Each segment carries
  // an optional onClick — the leaf (current selection) is plain
  // text so the user can't navigate to where they already are.
  type Crumb = { name: string; onClick?: () => void };
  const paneCrumbs = useMemo<Crumb[]>(() => {
    const all: Crumb = { name: 'All diagrams', onClick: () => go({ kind: 'all' }) };
    if (selected.kind === 'recent') return [{ name: 'Recent diagrams' }];
    if (selected.kind === 'shared') return [{ name: 'Shared with me' }];
    if (selected.kind === 'gallery') return [{ name: 'Image gallery' }];
    if (selected.kind === 'team') return [{ name: paneTitle }];
    if (selected.kind === 'invites') return [{ name: 'Invites' }];
    if (selected.kind === 'all') return [{ name: 'All diagrams' }];
    if (selected.kind === 'unsorted') return [all, { name: 'Unsorted' }];
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

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Folder-row context-menu actions, shared between the tree and
  // the list view so both surfaces offer the same set.
  const folderActions = (f: Folder, anchor: HTMLElement | null) => ({
    rename: () => setRenamingFolderId(f.id),
    newSubfolder: () => void createFolder(f.id),
    move: () => openMovePickerForFolder(f.id, anchor),
    delete: async () => {
      // Confirm + diagram-side cascade + useFolders delete, all in the
      // shared hook. Only bounce off the route if the deleted folder
      // itself was focused: descendants survive the delete (they're
      // now root folders), so a B-was-selected, delete-A flow should
      // keep B selected.
      const deleted = await deleteFolderWithCascade(f.id, f.name || 'folder');
      if (deleted && selected.kind === 'folder' && selected.id === f.id) {
        go({ kind: 'all' });
      }
    },
  });

  return {
    // Identity / auth
    authLoaded,
    clerkUserId,
    clerkDisplayName,
    ownerId,
    teamsEnabled,
    // Route
    selected,
    go,
    // Data
    diagrams,
    folders,
    shared,
    teams,
    teamFolders,
    teamDiagrams,
    invites,
    loading,
    folderById,
    childrenByParent,
    rootFolders,
    diagramsByFolder,
    unsortedDiagrams,
    paneContent,
    paneTitle,
    paneCrumbs,
    // Sidebar state
    expanded,
    toggleExpand,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    // Folder + diagram actions
    folderActions,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingDiagramId,
    setRenamingDiagramId,
    renameDiagram,
    deleteDiagram,
    duplicateDiagram,
    moveDiagramToFolder,
    moveDiagramToTeam,
    moveFolderToParent,
    openMovePickerForDiagram,
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    movePickerRows,
    dismissShared,
    // Teams
    hookCreateTeam,
    acceptInvite,
    declineInvite,
    refreshTeams,
    teamModalOpen,
    setTeamModalOpen,
  };
}

export type ExplorerStateValue = ReturnType<typeof useExplorerState>;
