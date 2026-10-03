'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { usePublishPicture } from '@/hooks/persistence/usePublishedPicture';
import {
  apiListDocuments,
  apiListSharedWith,
  type DocumentListItem,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import {
  fetchUserPreferences,
  readUserPreferences,
  toggleRecentExcluded,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { trackDailyReturn } from '@/lib/daily-return';
import { useFavourites } from '@/hooks/persistence/useFavourites';
import { useFolders } from '@/hooks/persistence/useFolders';
import { useAfterDriveChange } from '@/hooks/persistence/useAfterDriveChange';
import { useTeamLibrariesSweep } from '@/hooks/persistence/useTeamLibrariesSweep';
import { useTeams } from '@/hooks/persistence/useTeams';
import { useTokens } from '@/hooks/persistence/useTokens';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useDocumentListActions } from '@/hooks/persistence/useDocumentListActions';
import { useToast } from '@/hooks/ui/useToast';
import { explorerPathFor, selectedFromRoute } from './routes';
import { useExplorerLens } from './lens/useExplorerLens';
import { carriedHref, lensViewOf } from './lens/lens-views';
import { debugLog } from '@/lib/debug-log';
import { useTimelineUnread } from './useTimelineUnread';
import { useActivityFeed } from './useActivityFeed';
import { useExplorerMoves } from './useExplorerMoves';
import { useExplorerPane } from './useExplorerPane';
import { useSidebarExpansion } from './sidebar/useSidebarExpansion';
import { useHydrated } from '@/hooks/ui/useHydrated';
import { MY_DOCUMENTS_EXPAND_KEY } from './sidebar/sidebar-structure';
import type { SelectedNode } from './views';
import { indexFolders, folderBreadcrumb, folderDescendants } from '@/lib/folder-tree';
import { useOpenSettingsRequests } from '@/hooks/ui/useOpenSettingsRequests';
import { useDefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';

// All Explorer state + handlers, lifted out of the old single-page
// component when the sections became routes (docs/specs/013-workspace/folders.md): the layout's
// ExplorerShell instantiates this once and provides it via
// ExplorerContext, so the sidebar persists (data and all) while the
// child route under /explorer/<section> changes. The current section
// is no longer useState — it's derived from the URL, and `go`
// navigates, so back/forward and deep links work for free.
//
// Open to both guests and signed-in users (docs/specs/014-identity/auth-and-guest-access.md + docs/specs/013-workspace/folders.md): the
// owner id resolves to the Clerk userId when signed in, otherwise to
// the `livediagram:v2:self-id` localStorage UUID.
// The preferences a hydrating render sees: none.
const NO_PREFERENCES: UserPreferences = {};

export function useExplorerState() {
  // Full page loads once a newer build is live (docs/specs/016-platform/stale-builds.md).
  const router = useAppNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // What the tree highlights + the right pane shows, derived from the
  // address bar (routes.ts). /explorer itself redirects to /recent.
  const selected = useMemo<SelectedNode>(
    () => selectedFromRoute(pathname ?? '/explorer', searchParams),
    [pathname, searchParams],
  );

  const { authLoaded, clerkUserId, clerkDisplayName, isSignedIn } = useClerkApiBootstrap();
  // Keep the participant record's profile picture current (docs/specs/014-identity/profile-picture.md §6).
  usePublishPicture(clerkUserId);

  // Synced user preferences (docs/specs/007-editor/user-preferences.md). Owned HERE rather than in
  // ExplorerShell because the pane needs them too (Recent honours the
  // hidden-from-Recent list, docs/specs/013-workspace/hide-from-recent.md) — two useState copies would drift
  // the moment one of them wrote. Seeded from the localStorage cache; the
  // authoritative D1 copy merges in on mount. Exposed only once hydrated: a
  // build without sign-in prerenders this shell, and the render that
  // hydrates it must match that HTML (the sidebar's Minimal chrome, the
  // appearance control's power-user wording), so it sees no preferences.
  const [storedPrefs, setPrefs] = useState<UserPreferences>(() => readUserPreferences());
  const hydrated = useHydrated();
  const prefs = hydrated ? storedPrefs : NO_PREFERENCES;
  // Owner id resolution mirrors new/page.tsx + editor-page.tsx: a
  // signed-in user is keyed by Clerk userId, a guest is keyed by the
  // localStorage UUID (minted on first visit). Null until Clerk has
  // settled so a signed-in user never momentarily reads a guest id.
  // For a guest, resolve a SIGNED id (ensureSignedGuestIdentity, like the
  // editor's useIdentityBootstrap) rather than a bare ensureGuestSelfId, so the
  // `X-Owner-Sig` the §4 REST gate may require (docs/specs/015-api/public-api-and-tokens.md) is minted even for a
  // guest who opens the Explorer before ever touching the editor — otherwise
  // their document / folder list calls would 401 once enforcement is on. Async,
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
  // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): the Explorer is an app-open
  // surface too, so count a returning visitor here. Gated once per
  // browser per UTC day inside the helper (shared with the editor +
  // /new bootstraps), so landing here and then the editor still counts
  // once. Runs once auth has settled so guest vs signed-in is known.
  useEffect(() => {
    if (!authLoaded) return;
    trackDailyReturn(!!clerkUserId);
  }, [authLoaded, clerkUserId]);
  const [liveDocs, setDocuments] = useState<DocumentListItem[]>([]);
  const {
    folders,
    createFolder: hookCreateFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders(ownerId, { autoLoad: false });
  const [shared, setShared] = useState<SharedWithItem[]>([]);
  // Teams (docs/specs/013-workspace/teams.md): signed-in only. Guests get a sign-in prompt in
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
  // The lens (docs/specs/013-workspace/explorer-filters.md): one string narrowing every document
  // view, kept in step with `q` in the address bar.
  const lens = useExplorerLens({
    selected,
    teams,
    search: searchParams?.toString() ?? '',
    router,
  });
  // API tokens (docs/specs/015-api/public-api-and-tokens.md): signed-in only, same gate as teams. Loaded here for
  // the timeline's token-card menus, which offer Revoke for a token that is
  // still live. Managing them is the Settings API Tokens category.
  const tokens = useTokens(ownerId, { enabled: teamsEnabled });
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Which list read failed last, so a view says Failed rather than Empty.
  const [failedReads, setFailedReads] = useState({ documents: false, shared: false });
  // Folder id mid-rename so the tree / list row swaps to an input
  // until the user commits or escapes.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // Document id mid-rename. Same pattern as folders.
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Settings lives here rather than in ExplorerShell because the sidebar's
  // account button opens it too, now that the profile page it used to open
  // has been folded into the dialog (docs/specs/007-editor/user-preferences.md + docs/specs/014-identity/profile-and-email-notifications.md).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<{
    categoryId: string;
    rowKey: string;
  } | null>(null);
  // Category to open on, for the `?settings=` deep link. Distinct from
  // `settingsFocus`, which additionally rings one row.
  const [settingsCategory, setSettingsCategory] = useState<string | null>(null);
  // Section of it, for `&section=<id>` (the Drive connect flow returns to Cloud Sync).
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  // Open Settings on a category in place: the account menu, and any link
  // that names one (a timeline token card, lib/open-settings.ts).
  // `sectionId` scrolls to and focuses one section of it (settingsSectionId).
  const openSettingsOn = useCallback((categoryId: string, sectionId?: string) => {
    setSettingsFocus(null);
    setSettingsCategory(categoryId);
    setSettingsSection(sectionId ?? null);
    setSettingsOpen(true);
  }, []);
  useOpenSettingsRequests(openSettingsOn);
  // `?settings=<category>` deep link. The Settings dialog replaced the
  // /explorer/profile page (docs/specs/014-identity/profile-and-email-notifications.md), and mail already in people's inboxes
  // links at their notification preferences, so any surface can name the pane
  // it means. Opened during render, once per link. The params stay while
  // Settings is open, so a page left for Google and reached again with Back
  // reopens it (docs/specs/007-editor/user-preferences.md), and go when it closes.
  // Read once hydrated: the page is prerendered without a query string, so opening Settings in the
  // render that hydrates it would not match the HTML it hydrates.
  const settingsLink = hydrated ? (searchParams?.get('settings') ?? null) : null;
  const sectionLink = hydrated ? (searchParams?.get('section') ?? null) : null;
  const [settingsLinkSeen, setSettingsLinkSeen] = useState<string | null>(null);
  if (settingsLink !== settingsLinkSeen) {
    setSettingsLinkSeen(settingsLink);
    if (settingsLink) {
      setSettingsCategory(settingsLink);
      setSettingsSection(sectionLink);
      setSettingsOpen(true);
    }
  }
  // Which sidebar rows are open: folders, teams, My documents and Library
  // (docs/specs/013-workspace/explorer-structure.md#expansion).
  const { expanded, expand, toggleExpand } = useSidebarExpansion(selected);
  // Team libraries swept lazily (docs/specs/013-workspace/team-shared-documents.md) for the four consumers: the
  // search panel's Folders group, the move modal's team destinations,
  // the Recent list's team rows, and the sidebar's team subtrees.
  // Recent is the landing section, so signed-in members effectively
  // sweep on arrival; guests (no teams) never fetch.
  const {
    teamFolders,
    teamDocuments,
    refresh: refreshTeamLibraries,
  } = useTeamLibrariesSweep(ownerId, teams, {
    // The sidebar renders every team as a collapsible folder tree on
    // EVERY explorer route (docs/specs/013-workspace/team-shared-documents.md), so it needs each team's folders to
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
  // The lens rides along only from one aggregate view to another (explorer-filters.md "URL and carry-over").
  const go = useCallback(
    (node: SelectedNode) => {
      const to = lensViewOf(node.kind);
      const href = carriedHref(explorerPathFor(node), lens.input, lens.view, to);
      if (lens.input.trim() !== '') {
        debugLog(
          `[explorer-lens] carried from=${lens.view ?? 'none'} to=${to ?? 'none'} kept=${href.includes('q=')}`,
        );
      }
      router.push(href);
      setMobileNavOpen(false);
    },
    [router, lens.input, lens.view],
  );
  const confirm = useConfirm();
  const toast = useToast();

  // One read of the lists, settling state only from the responses, so the
  // load effect below only starts it.
  const load = useCallback(
    (ownerId: string) =>
      Promise.all([
        apiListDocuments(ownerId).catch(() => null),
        apiListSharedWith(ownerId).catch(() => null),
        refreshFolders(),
      ]).then(([list, sharedList]) => {
        // A failed load must not masquerade as an empty account: set only what actually came
        // back (a failed list keeps its prior value), and the views that read a failed list
        // show Failed rather than "you have no documents" (explorer-filters.md "States").
        if (list !== null) setDocuments(list);
        if (sharedList !== null) setShared(sharedList);
        setFailedReads({ documents: list === null, shared: sharedList === null });
        if (list === null) console.warn('[explorer] list read failed list=documents');
        if (sharedList === null) console.warn('[explorer] list read failed list=shared');
        // Only the shared read failed: the other views still list their rows, so say what is missing.
        if (list !== null && sharedList === null) {
          toast.error('Couldn’t load the documents shared with you. Try again in a moment.');
        }
        setLoading(false);
      }),
    [refreshFolders, toast],
  );

  const refresh = useCallback(
    async (ownerId: string) => {
      setLoading(true);
      await load(ownerId);
    },
    [load],
  );

  // A guest's ownerId resolves asynchronously now (ensureSignedGuestIdentity
  // above), so it lags `authLoaded` by a tick. Keep the skeleton rather than
  // flashing an empty state — ownerId always resolves (signed-in → Clerk id;
  // guest → minted id), so this never stalls. A new owner is loading from its
  // first render.
  const loadOwner = authLoaded ? ownerId : null;
  const [loadingFor, setLoadingFor] = useState(loadOwner);
  if (loadOwner !== loadingFor) {
    setLoadingFor(loadOwner);
    if (loadOwner) setLoading(true);
  }
  useEffect(() => {
    if (loadOwner) void load(loadOwner);
  }, [loadOwner, load]);
  // A change made in Google Drive reaches this page without a reload
  // (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow"). Quietly:
  // no skeleton, the lists just settle.
  useAfterDriveChange(() => {
    if (loadOwner) void load(loadOwner);
  }, !!loadOwner);

  // ---- Derived tree shape ---------------------------------------
  // Index folders by parentId so the recursive renderer can walk
  // children in O(1) per node, and by id so breadcrumb-from-id can
  // walk parents without re-scanning the list.
  const { folderById, childrenByParent, rootFolders } = useMemo(() => {
    return indexFolders(folders);
  }, [folders]);

  // Build a breadcrumb path from root → folderId, used both by the
  // header and the move-picker rows. Tolerant of dangling parentIds
  // (which can happen mid-refresh between an optimistic delete and
  // the server response). Returns [] for `all` / virtual nodes.
  const breadcrumb = useCallback(
    (folderId: string | null): Folder[] => {
      return folderBreadcrumb(folderById, folderId);
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
      return folderDescendants(childrenByParent, rootId);
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
      // Reveal the new row so its rename field shows: its parent, or My documents for a root folder.
      expand(parentId ?? MY_DOCUMENTS_EXPAND_KEY);
    }
  };

  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    renameFolder(id, name);
  };

  // Document-row + Shared-row mutations come from the shared
  // useDocumentListActions hook (the same behaviours behind the
  // editor's Explorer panel and /new), so the optimistic updates,
  // API calls, telemetry, and confirm copy stay single-sourced. The
  // hook wraps the rename to also clear its inline-rename state.
  const {
    renameDocument: listRenameDocument,
    deleteDocument: listDeleteDocument,
    deleteFolder: deleteFolderWithCascade,
    moveDocumentToFolder,
    duplicateDocument: listDuplicateDocument,
    dismissSharedDocument: dismissShared,
  } = useDocumentListActions({
    ownerId,
    documentList: liveDocs,
    setDocumentList: setDocuments,
    confirm,
    toast,
    deleteFolderFromHook: deleteFolder,
    folders,
    // Stay on the library after a duplicate; just refresh the list
    // so the copy's row appears.
    afterDuplicate: async () => {
      if (!ownerId) return;
      const list = await apiListDocuments(ownerId).catch(() => null);
      if (list) setDocuments(list);
    },
    sharedDocuments: shared,
    setSharedDocuments: setShared,
  });

  // Rename / delete / duplicate also re-sweep the team libraries:
  // these actions are wired against the personal `liveDocs` list, so a
  // team document in Recent (which lives in the sweep, not `liveDocs`)
  // wouldn't otherwise repaint after the action lands (docs/specs/013-workspace/team-shared-documents.md).
  const renameDocument = (id: string, name: string) => {
    setRenamingDocumentId(null);
    listRenameDocument(id, name);
    refreshTeamLibraries();
  };

  const deleteDocument = async (
    id: string,
    beforeRemove?: () => Promise<void> | void,
    opts?: { skipConfirm?: boolean },
  ) => {
    await listDeleteDocument(id, beforeRemove, opts);
    refreshTeamLibraries();
  };

  const duplicateDocument = async (id: string) => {
    await listDuplicateDocument(id);
    refreshTeamLibraries();
  };

  // The unified move picker's state, handlers, and destination trees
  // (docs/specs/013-workspace/team-shared-documents.md) live in useExplorerMoves.
  const {
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    moveFolderToParent,
    createMoveFolder,
    moveDocumentToTeam,
    moveTeamDocumentToFolder,
    moveTeamDocumentOut,
    moveDocumentTo,
    openMovePickerForDocument,
    openMovePickerForFolder,
    movePersonalFolders,
    moveTeamDests,
  } = useExplorerMoves({
    ownerId,
    documents: liveDocs,
    setDocuments,
    folders,
    teams,
    teamFolders,
    teamDocuments,
    descendantSet,
    refreshFolders,
    refreshTeamLibraries,
    refreshPersonal: refresh,
    moveDocumentToFolder,
    toast,
  });

  // Right-pane derivations (buckets, synthetic folders, pane content /
  // title / crumbs, Recent badge) live in useExplorerPane.
  // Per-user document stars (docs/specs/013-workspace/favourites.md). Its own D1 table rather than the
  // preferences blob, which is 4 KB-capped; favourites are unlimited.
  const { favouriteIds, toggleFavourite } = useFavourites(ownerId);

  const timelineUnread = useTimelineUnread(ownerId);

  // What's outstanding for the reader (docs/specs/013-workspace/activity-page.md). Read once here rather
  // than in the section, because the sidebar badge draws from the same
  // list on every Explorer section.
  const activity = useActivityFeed(ownerId);

  const {
    documentsByFolder,
    offlineDocuments,
    paneContent,
    lensResult,
    recentCount,
    paneTitle,
    paneCrumbs,
  } = useExplorerPane({
    selected,
    documents: liveDocs,
    teamDocuments,
    shared,
    childrenByParent,
    folderById,
    teams,
    breadcrumb,
    go,
    recentExcludedIds: prefs.recentExcludedIds ?? [],
    favouriteIds,
    lens: lens.parsed.lens,
    viewerId: ownerId ?? '',
    now: lens.now,
  });

  // Merge the authoritative D1 preferences in once the owner is known.
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (!cancelled && merged) setPrefs(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  // Hide / show a document in Recent (docs/specs/013-workspace/hide-from-recent.md). Read-modify-writes from the
  // CACHE rather than the React snapshot: the PUT sends the whole blob, so
  // a stale snapshot would clobber sibling flags written by another tab.
  const toggleRecentExclusion = useCallback(
    (documentId: string) => {
      const latest = readUserPreferences();
      const next: UserPreferences = {
        ...latest,
        recentExcludedIds: toggleRecentExcluded(latest, documentId),
      };
      setPrefs(next);
      writeUserPreferences(next, ownerId ?? undefined);
    },
    [ownerId],
  );

  // Default folders (docs/specs/013-workspace/default-folders.md): the menus' checks and verbs.
  const defaultFolders = useDefaultFolderMenus(ownerId, {
    personal: folders,
    team: teamFolders,
    teams,
  });

  // Folder-row context-menu actions, shared between the tree and
  // the list view so both surfaces offer the same set.
  const folderActions = (f: Folder, anchor: HTMLElement | null) => ({
    defaults: defaultFolders.forFolder(f),
    rename: () => setRenamingFolderId(f.id),
    newSubfolder: () => void createFolder(f.id),
    move: () => openMovePickerForFolder(f.id, anchor),
    delete: async () => {
      // Confirm + document-side cascade + useFolders delete, all in the
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
    documents: liveDocs,
    folders,
    shared,
    teams,
    teamFolders,
    teamDocuments,
    // My documents' own menu: "Use as default for" only.
    rootDefaults: defaultFolders.forRoot,
    invites,
    tokens,
    loading,
    // Re-read the owner's lists (after an import made documents).
    refreshPersonal: refresh,
    folderById,
    childrenByParent,
    rootFolders,
    documentsByFolder,
    offlineDocuments,
    paneContent,
    // The lens and what it did to the current view (docs/specs/013-workspace/explorer-filters.md).
    lens,
    lensResult,
    failedReads,
    recentCount,
    // Unread Timeline events (docs/specs/013-workspace/timeline.md §2.5), for the sidebar badge.
    timelineUnread,
    // What's outstanding for the reader (docs/specs/013-workspace/activity-page.md): the Activity pane's
    // lists + the sidebar badge's count.
    activity,
    // Per-user document stars (docs/specs/013-workspace/favourites.md).
    favouriteIds,
    toggleFavourite,
    // Preferences (docs/specs/007-editor/user-preferences.md) + the Recent exclusion toggle (docs/specs/013-workspace/hide-from-recent.md).
    prefs,
    setPrefs,
    toggleRecentExclusion,
    paneTitle,
    paneCrumbs,
    // Sidebar state
    expanded,
    toggleExpand,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    settingsFocus,
    setSettingsFocus,
    settingsCategory,
    setSettingsCategory,
    settingsSection,
    setSettingsSection,
    openSettingsOn,
    // Folder + document actions
    folderActions,
    createFolder,
    commitRenameFolder,
    renamingFolderId,
    setRenamingFolderId,
    renamingDocumentId,
    setRenamingDocumentId,
    renameDocument,
    deleteDocument,
    duplicateDocument,
    moveDocumentToFolder,
    moveDocumentToTeam,
    moveTeamDocumentToFolder,
    moveTeamDocumentOut,
    moveDocumentTo,
    moveFolderToParent,
    createMoveFolder,
    openMovePickerForDocument,
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
    // After a restore from the Trash (docs/specs/013-workspace/trash.md): the
    // document is back in a personal or team list.
    refreshLibraries: () => {
      if (ownerId) void refresh(ownerId);
      refreshTeamLibraries();
    },
    teamModalOpen,
    setTeamModalOpen,
  };
}

export type ExplorerStateValue = ReturnType<typeof useExplorerState>;
