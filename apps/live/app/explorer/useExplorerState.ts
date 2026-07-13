'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import {
  apiListDiagrams,
  apiListSharedWith,
  type DiagramListItem,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { useFolders } from '@/hooks/persistence/useFolders';
import { useTeamLibrariesSweep } from '@/hooks/persistence/useTeamLibrariesSweep';
import { useTeams } from '@/hooks/persistence/useTeams';
import { useTokens } from '@/hooks/persistence/useTokens';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useDiagramListActions } from '@/hooks/persistence/useDiagramListActions';
import { useToast } from '@/hooks/ui/useToast';
import { explorerPathFor, selectedFromRoute } from './routes';
import { useExplorerMoves } from './useExplorerMoves';
import { useExplorerPane } from './useExplorerPane';
import type { SelectedNode } from './views';

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
  // For a guest, resolve a SIGNED id (ensureSignedGuestIdentity, like the
  // editor's useIdentityBootstrap) rather than a bare ensureGuestSelfId, so the
  // `X-Owner-Sig` the §4 REST gate may require (spec/61) is minted even for a
  // guest who opens the Explorer before ever touching the editor — otherwise
  // their diagram / folder list calls would 401 once enforcement is on. Async,
  // so ownerId stays null until it resolves (the lists are autoLoad:false off
  // ownerId, and the common case — an existing signed id — resolves with no
  // network).
  const [guestId, setGuestId] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoaded || clerkUserId) return;
    let cancelled = false;
    void ensureSignedGuestIdentity().then((r) => {
      if (!cancelled) setGuestId(r.id);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoaded, clerkUserId]);
  const ownerId: string | null = !authLoaded ? null : (clerkUserId ?? guestId);
  // Daily-active-returns signal (spec/22): the Explorer is an app-open
  // surface too, so count a returning visitor here. Gated once per
  // browser per UTC day inside the helper (shared with the editor +
  // /new bootstraps), so landing here and then the editor still counts
  // once. Runs once auth has settled so guest vs signed-in is known.
  useEffect(() => {
    if (!authLoaded) return;
    trackDailyReturn(!!clerkUserId);
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
  // API tokens (spec/61): signed-in only, same gate as teams. Loaded here so
  // the sidebar badge, the header New-token popover, and the list pane share
  // one source.
  const tokens = useTokens(ownerId, { enabled: teamsEnabled });
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Folder id mid-rename so the tree / list row swaps to an input
  // until the user commits or escapes.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // Diagram id mid-rename. Same pattern as folders.
  const [renamingDiagramId, setRenamingDiagramId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Which folder branches (and which teams) are open in the sidebar.
  // Local state only; a fresh visit starts everything collapsed. Team
  // ids live in the same set so a team's folder subtree expands the
  // same way a personal folder does (one expand model, spec/35).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());
  // Team libraries swept lazily (spec/35) for the four consumers: the
  // search panel's Folders group, the move modal's team destinations,
  // the Recent list's team rows, and the sidebar's team subtrees.
  // Recent is the landing section, so signed-in members effectively
  // sweep on arrival; guests (no teams) never fetch.
  const {
    teamFolders,
    teamDiagrams,
    refresh: refreshTeamLibraries,
  } = useTeamLibrariesSweep(ownerId, teams, {
    // The sidebar renders every team as a collapsible folder tree on
    // EVERY explorer route (spec/35), so it needs each team's folders to
    // know whether to show the expand chevron — not just on Recent /
    // search / move. Gating on the route (e.g. `selected.kind === 'recent'`)
    // meant a hard navigation onto a team folder (which the sidebar opens
    // via window.location.assign → /explorer/team) landed with the sweep
    // off, so the team showed no folders and couldn't be expanded. The
    // hook no-ops for guests / teamless sessions and dedupes per team set,
    // so enabling whenever a team exists is one cheap sweep — and it
    // subsumes the old search / move / recent / expanded conditions.
    enabled: teams.length > 0,
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
  const toast = useToast();

  const refresh = useCallback(
    async (ownerId: string) => {
      setLoading(true);
      const [list, sharedList] = await Promise.all([
        apiListDiagrams(ownerId).catch(() => null),
        apiListSharedWith(ownerId).catch(() => null),
        refreshFolders(),
      ]);
      // A failed load must not masquerade as an empty account: set only what
      // actually came back (a failed list keeps its prior value) and tell the
      // user, rather than flashing the "you have no diagrams" empty state.
      if (list !== null) setDiagrams(list);
      if (sharedList !== null) setShared(sharedList);
      if (list === null || sharedList === null) {
        toast.error('Could not load your diagrams. Check your connection and try again.');
      }
      setLoading(false);
    },
    [refreshFolders, toast],
  );

  useEffect(() => {
    if (!authLoaded) return;
    if (!ownerId) {
      // A guest's ownerId resolves asynchronously now (ensureSignedGuestIdentity
      // above), so it lags `authLoaded` by a tick. Keep the skeleton rather than
      // flashing an empty state — ownerId always resolves (signed-in → Clerk id;
      // guest → minted id), so this never stalls.
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

  // Diagram-row + Shared-row mutations come from the shared
  // useDiagramListActions hook (the same behaviours behind the
  // editor's Explorer panel and /new), so the optimistic updates,
  // API calls, telemetry, and confirm copy stay single-sourced. The
  // hook wraps the rename to also clear its inline-rename state.
  const {
    renameDiagram: listRenameDiagram,
    deleteDiagram: listDeleteDiagram,
    deleteFolder: deleteFolderWithCascade,
    moveDiagramToFolder,
    duplicateDiagram: listDuplicateDiagram,
    dismissSharedDiagram: dismissShared,
  } = useDiagramListActions({
    ownerId,
    diagramList: diagrams,
    setDiagramList: setDiagrams,
    confirm,
    toast,
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

  // Rename / delete / duplicate also re-sweep the team libraries:
  // these actions are wired against the personal `diagrams` list, so a
  // team diagram in Recent (which lives in the sweep, not `diagrams`)
  // wouldn't otherwise repaint after the action lands (spec/35).
  const renameDiagram = (id: string, name: string) => {
    setRenamingDiagramId(null);
    listRenameDiagram(id, name);
    refreshTeamLibraries();
  };

  const deleteDiagram = async (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => {
    await listDeleteDiagram(id, beforeRemove, opts);
    refreshTeamLibraries();
  };

  const duplicateDiagram = async (id: string) => {
    await listDuplicateDiagram(id);
    refreshTeamLibraries();
  };

  // The unified move picker's state, handlers, and destination trees
  // (spec/35) live in useExplorerMoves.
  const {
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    moveFolderToParent,
    createMoveFolder,
    moveDiagramToTeam,
    moveTeamDiagramToFolder,
    moveTeamDiagramOut,
    moveDiagramTo,
    openMovePickerForDiagram,
    openMovePickerForFolder,
    movePersonalFolders,
    moveTeamDests,
  } = useExplorerMoves({
    ownerId,
    diagrams,
    setDiagrams,
    folders,
    teams,
    teamFolders,
    teamDiagrams,
    descendantSet,
    refreshFolders,
    refreshTeamLibraries,
    refreshPersonal: refresh,
    moveDiagramToFolder,
    toast,
  });

  // Right-pane derivations (buckets, synthetic folders, pane content /
  // title / crumbs, Recent badge) live in useExplorerPane.
  const {
    diagramsByFolder,
    unsortedDiagrams,
    generatedDiagrams,
    offlineDiagrams,
    paneContent,
    recentCount,
    paneTitle,
    paneCrumbs,
  } = useExplorerPane({
    selected,
    diagrams,
    teamDiagrams,
    shared,
    childrenByParent,
    folderById,
    teams,
    breadcrumb,
    go,
  });

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
    tokens,
    loading,
    folderById,
    childrenByParent,
    rootFolders,
    diagramsByFolder,
    unsortedDiagrams,
    generatedDiagrams,
    offlineDiagrams,
    paneContent,
    recentCount,
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
    moveTeamDiagramToFolder,
    moveTeamDiagramOut,
    moveDiagramTo,
    moveFolderToParent,
    createMoveFolder,
    openMovePickerForDiagram,
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    movePersonalFolders,
    moveTeamDests,
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
