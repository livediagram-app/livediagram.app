'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';
import { AuthControls } from '@/components/AuthControls';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiDeleteDiagram,
  apiDismissSharedWith,
  apiListDiagrams,
  apiListSharedWith,
  apiSaveDiagramMeta,
  apiSetDiagramFolder,
  apiUpdateFolder,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { ensureGuestSelfId } from '@/lib/local-identity';
import { track } from '@/lib/telemetry';
import { useFolders } from '@/hooks/useFolders';
import { useConfirm } from '@/hooks/useConfirm';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import dynamic from 'next/dynamic';
import { MenuItem, PortalMenu } from '@/components/PortalMenu';
// Lazy-load SearchPanel — same rationale as the editor route: it's
// gated on `searchOpen`, never default-rendered, and dropping ~375
// lines from the Explorer page's initial chunk pays for itself
// immediately on the first paint of the dashboard.
const SearchPanel = dynamic(() => import('@/components/SearchPanel').then((m) => m.SearchPanel));
// Lazy-load GalleryPane the same way: only mounted when the user
// picks the Image Gallery sidebar item, so the upload + delete +
// usage view doesn't sit in the default explorer chunk.
const GalleryPane = dynamic(() => import('@/components/GalleryPane').then((m) => m.GalleryPane));
import { ClockIcon, FolderIcon, HomeIcon, ImageIcon, MenuFolderIcon, ShareIcon } from './icons';
import {
  SearchSidebarIcon,
  SidebarFolderSubtree,
  SidebarRow,
  SidebarSectionLabel,
} from './sidebar';
import {
  EmptyPane,
  ListView,
  PaneHeader,
  SharedList,
  SkeletonRows,
  type DiagramItem,
  type SelectedNode,
} from './views';

// "Recent" cap. Big enough for "what was I just working on",
// small enough that it doesn't drown the list view.
const RECENT_LIMIT = 12;

// Sidebar width. Wide enough for ~3 levels of indented folder names,
// narrow enough that the list view keeps its breathing room.
const SIDEBAR_WIDTH = 256;

// Full-page Explorer (item #12). Open to both guests and signed-in
// users (spec/04 + spec/15): the owner id resolves to the Clerk userId
// when signed in, otherwise to the `livediagram:v2:self-id` localStorage
// UUID (minting one on first visit, same as `/live/new`). Signed-out
// visitors get the AuthControls "Sign in" CTA in the page header but
// the library view itself is not gated, so guests can browse + rename
// + delete + foldering the diagrams their per-browser id already owns.
//
// Layout shape (spec/15): split view, sidebar tree on the left for
// navigation, breadcrumb + list view on the right for the focused
// folder's contents. Subfolders nest in both panes; selecting a
// folder in the tree or double-clicking a folder row drills in.
export default function ExplorerPage() {
  const { authLoaded, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();
  // Owner id resolution mirrors new/page.tsx + editor-page.tsx: a
  // signed-in user is keyed by Clerk userId, a guest is keyed by the
  // localStorage UUID (minted on first visit). Null until Clerk has
  // settled so a signed-in user never momentarily reads a guest id.
  const ownerId: string | null = useMemo(() => {
    if (!authLoaded) return null;
    return clerkUserId ?? ensureGuestSelfId();
  }, [authLoaded, clerkUserId]);
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const {
    folders,
    createFolder: hookCreateFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders(ownerId, { autoLoad: false });
  const [shared, setShared] = useState<SharedWithItem[]>([]);
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
  // What the tree highlights + right pane shows. Defaults to "All
  // diagrams" (the root) so the first impression is the full library
  // — Recent is one sidebar click away.
  // Land on Recent — the diagrams you're most likely to want — rather
  // than the full folder tree.
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'recent' });
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
  const breadcrumb = (folderId: string | null): Folder[] => {
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
  };

  // Set of folder ids that are descendants of (or equal to) the
  // given root. Used to hide a folder + its subtree from the
  // move-picker — moving a folder into its own descendant would
  // be a cycle (server rejects, but pre-filtering keeps the UI
  // honest).
  const descendantSet = (rootId: string): Set<string> => {
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
  };

  // ---- Mutations -----------------------------------------------
  // Wrapper around the hook's create that drops the user into
  // rename mode on the new stub, optionally nesting it under a
  // parent. Used by both the FAB (parentId=null) and the tree /
  // list "New subfolder" actions (parentId=<current folder>).
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
    // Optimistic: rewrite the folder row's parentId locally. The
    // useFolders hook owns the canonical state; we reach in via
    // `setFolders` — but that's not exposed by the hook... so kick
    // a refresh after the mutation lands instead. Folder moves are
    // rare enough that one extra round-trip is fine.
    void refreshFolders();
    track('Folder', 'Moved');
  };

  const renameDiagram = (id: string, name: string) => {
    if (!ownerId) return;
    const trimmed = name.trim();
    setRenamingDiagramId(null);
    if (!trimmed) return;
    const prevName = diagrams.find((d) => d.id === id)?.name?.trim() ?? '';
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveDiagramMeta(ownerId, { id, name: trimmed }).catch(() => {});
    if (trimmed !== prevName) track('Diagram', 'Renamed');
  };

  const deleteDiagram = async (id: string) => {
    if (!ownerId) return;
    const target = diagrams.find((d) => d.id === id);
    const ok = await confirm({
      title: `Delete "${target?.name || 'this diagram'}"?`,
      message:
        'Every tab, change-log entry, and share link on this diagram is removed. Visitors holding a share link will see a 404. This cannot be undone.',
      confirmLabel: 'Delete diagram',
    });
    if (!ok) return;
    track('Diagram', 'Deleted');
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(ownerId, id).catch(() => {});
  };

  const moveDiagramToFolder = (id: string, folderId: string | null) => {
    if (!ownerId) return;
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(ownerId, id, folderId).catch(() => {});
    track('Diagram', 'Moved');
  };

  const duplicateDiagram = async (id: string) => {
    if (!ownerId) return;
    await duplicate(ownerId, id);
    const list = await apiListDiagrams(ownerId).catch(() => null);
    if (list) setDiagrams(list);
  };

  const dismissShared = async (diagramId: string) => {
    if (!ownerId) return;
    const target = shared.find((s) => s.id === diagramId);
    const ok = await confirm({
      title: `Remove "${target?.name || 'this diagram'}" from your Shared list?`,
      message:
        "It'll vanish from your Shared with you list. You can still open it again from the share link the owner gave you, and that re-adds it here.",
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setShared((prev) => prev.filter((s) => s.id !== diagramId));
    void apiDismissSharedWith(ownerId, diagramId).catch(() => {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, moveTarget]);

  // ---- Right-pane content --------------------------------------
  const diagramsByFolder = useMemo(() => {
    const m = new Map<string | null, DiagramItem[]>();
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
  // - `shared`: handled separately via SharedList.
  // - `all`: root user folders + the synthetic Unsorted bucket as a
  //   leading row when there are unsorted diagrams. Loose root-level
  //   diagrams don't appear here directly; they live in Unsorted so
  //   the root view stays purely a folder index.
  // - `unsorted`: just diagrams with folderId === null.
  // - `folder`: direct subfolders + direct diagrams in that folder.
  const paneContent = useMemo<{
    showUnsortedRow: boolean;
    folders: Folder[];
    diagrams: DiagramItem[];
  }>(() => {
    if (selected.kind === 'recent') {
      const sorted = diagrams.slice().sort((a, b) => b.savedAt - a.savedAt);
      return { showUnsortedRow: false, folders: [], diagrams: sorted.slice(0, RECENT_LIMIT) };
    }
    if (selected.kind === 'shared') {
      return { showUnsortedRow: false, folders: [], diagrams: [] };
    }
    if (selected.kind === 'gallery') {
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
  }, [selected, diagrams, childrenByParent, diagramsByFolder, unsortedDiagrams]);

  const paneTitle = useMemo(() => {
    if (selected.kind === 'recent') return 'Recent';
    if (selected.kind === 'shared') return 'Shared with me';
    if (selected.kind === 'gallery') return 'Image Gallery';
    if (selected.kind === 'all') return 'All diagrams';
    if (selected.kind === 'unsorted') return 'Unsorted';
    return folderById.get(selected.id)?.name ?? 'Folder';
  }, [selected, folderById]);

  // Breadcrumb segments for the pane header. Each segment carries
  // an optional onClick — the leaf (current selection) is plain
  // text so the user can't navigate to where they already are.
  type Crumb = { name: string; onClick?: () => void };
  const paneCrumbs = useMemo<Crumb[]>(() => {
    const all: Crumb = { name: 'All diagrams', onClick: () => setSelected({ kind: 'all' }) };
    if (selected.kind === 'recent') return [{ name: 'Recent' }];
    if (selected.kind === 'shared') return [{ name: 'Shared with me' }];
    if (selected.kind === 'gallery') return [{ name: 'Image Gallery' }];
    if (selected.kind === 'all') return [{ name: 'All diagrams' }];
    if (selected.kind === 'unsorted') return [all, { name: 'Unsorted' }];
    const chain = breadcrumb(selected.id);
    return [
      all,
      ...chain.slice(0, -1).map((c) => ({
        name: c.name,
        onClick: () => setSelected({ kind: 'folder', id: c.id }),
      })),
      { name: chain[chain.length - 1]?.name ?? 'Folder' },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, folderById]);

  // Wait for Clerk to settle so a signed-in user never momentarily
  // reads the localStorage guest id and refreshes against the wrong
  // owner. After this gate, `ownerId` is either the Clerk userId or
  // the guest UUID (never null in practice).
  if (!authLoaded) return null;

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
      const ok = await confirm({
        title: `Delete "${f.name || 'folder'}"?`,
        message:
          'Diagrams inside this folder move to Unsorted. Subfolders are promoted to the root. The folder row itself is removed.',
        confirmLabel: 'Delete folder',
      });
      if (!ok) return;
      // Mirror what the server actually does (apps/api/src/db.ts
      // deleteFolder): only direct children get re-parented or
      // null-folder-ed. Subfolders of f become root-level (handled
      // inside useFolders.deleteFolder); diagrams directly inside
      // f fall to Unsorted; diagrams inside subfolders stay where
      // they are (their parent folder still exists, it just moved
      // to root). The earlier code descended the whole subtree
      // and over-collapsed grandchildren into Unsorted, diverging
      // from server state until the next list refresh.
      setDiagrams((prev) => prev.map((d) => (d.folderId === f.id ? { ...d, folderId: null } : d)));
      deleteFolder(f.id);
      // Only bounce selection if the deleted folder itself was
      // focused. Descendants survive the delete (they're now root
      // folders), so a B-was-selected, delete-A flow should keep
      // B selected.
      if (selected.kind === 'folder' && selected.id === f.id) {
        setSelected({ kind: 'all' });
      }
    },
  });

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brand href="/" size="md" />
          <span className="text-sm font-medium text-slate-500">Explorer</span>
        </div>
        <AuthControls />
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pb-16 pt-6 sm:px-6">
        {/* ---------- Sidebar tree ---------- */}
        {/* Hidden on mobile: at 375px the 256px sidebar swallows
            the right pane entirely. Users on a phone navigate via
            the right pane (folder rows + the existing header search
            button); the full sidebar tree is desktop chrome. */}
        <aside
          className="hidden shrink-0 self-start sm:block"
          style={{ width: SIDEBAR_WIDTH }}
          aria-label="Folders"
        >
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white px-3 py-5 shadow-sm">
            <SidebarSectionLabel first>Hi {clerkDisplayName ?? 'there'}</SidebarSectionLabel>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <SearchSidebarIcon />
              <span className="flex-1 truncate">Search...</span>
            </button>
            <div className="my-4 h-px bg-slate-100" aria-hidden />
            <SidebarRow
              icon={<ClockIcon />}
              label="Recent"
              selected={selected.kind === 'recent'}
              onClick={() => setSelected({ kind: 'recent' })}
              depth={0}
            />

            <SidebarSectionLabel>Folders</SidebarSectionLabel>
            <SidebarRow
              icon={<HomeIcon />}
              label="All diagrams"
              selected={selected.kind === 'all'}
              onClick={() => setSelected({ kind: 'all' })}
              depth={0}
              hasChildren={rootFolders.length > 0}
              expanded={true}
              onToggleExpand={undefined}
            />
            {/* Unsorted is a synthetic folder backed by folder_id IS
                NULL — always present at the top of the root level so
                loose diagrams have somewhere obvious to land. */}
            <SidebarRow
              icon={<FolderIcon open={false} />}
              label="Unsorted"
              selected={selected.kind === 'unsorted'}
              onClick={() => setSelected({ kind: 'unsorted' })}
              depth={1}
              badge={unsortedDiagrams.length > 0 ? unsortedDiagrams.length : undefined}
            />
            {rootFolders.map((f) => (
              <SidebarFolderSubtree
                key={f.id}
                folder={f}
                depth={1}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                selected={selected}
                onSelect={(id) => setSelected({ kind: 'folder', id })}
                childrenByParent={childrenByParent}
                renamingFolderId={renamingFolderId}
                onCommitRenameFolder={commitRenameFolder}
                onCancelRenameFolder={() => setRenamingFolderId(null)}
                folderActions={folderActions}
              />
            ))}

            <SidebarSectionLabel>Library</SidebarSectionLabel>
            <SidebarRow
              icon={<ImageIcon />}
              label="Image Gallery"
              selected={selected.kind === 'gallery'}
              onClick={() => setSelected({ kind: 'gallery' })}
              depth={0}
            />

            <SidebarSectionLabel>Shared</SidebarSectionLabel>
            <SidebarRow
              icon={<ShareIcon />}
              label="Shared with me"
              selected={selected.kind === 'shared'}
              onClick={() => setSelected({ kind: 'shared' })}
              depth={0}
              badge={shared.length > 0 ? shared.length : undefined}
            />
          </div>
        </aside>

        {/* ---------- Right pane ---------- */}
        <section className="min-w-0 flex-1">
          <PaneHeader
            title={paneTitle}
            crumbs={paneCrumbs}
            onCreateDiagram={
              selected.kind === 'shared' || selected.kind === 'gallery'
                ? undefined
                : () =>
                    window.location.assign(
                      selected.kind === 'folder' ? `/live/new?folder=${selected.id}` : '/live/new',
                    )
            }
            onCreateFolder={
              selected.kind === 'shared' ||
              selected.kind === 'gallery' ||
              selected.kind === 'recent'
                ? undefined
                : () => createFolder(selected.kind === 'folder' ? selected.id : null)
            }
            folderLabel={selected.kind === 'folder' ? 'New subfolder' : 'New folder'}
          />

          {loading ? (
            <SkeletonRows />
          ) : selected.kind === 'gallery' ? (
            ownerId ? (
              <GalleryPane ownerId={ownerId} />
            ) : null
          ) : selected.kind === 'shared' ? (
            <SharedList shared={shared} onDismiss={dismissShared} />
          ) : paneContent.folders.length === 0 &&
            paneContent.diagrams.length === 0 &&
            !paneContent.showUnsortedRow ? (
            <EmptyPane selected={selected} />
          ) : (
            <ListView
              folders={paneContent.folders}
              diagrams={paneContent.diagrams}
              showUnsortedRow={paneContent.showUnsortedRow}
              unsortedCount={unsortedDiagrams.length}
              onOpenUnsorted={() => setSelected({ kind: 'unsorted' })}
              onOpenFolder={(id) => setSelected({ kind: 'folder', id })}
              onCommitRenameFolder={commitRenameFolder}
              onCancelRenameFolder={() => setRenamingFolderId(null)}
              renamingFolderId={renamingFolderId}
              renamingDiagramId={renamingDiagramId}
              onCommitRenameDiagram={renameDiagram}
              onCancelRenameDiagram={() => setRenamingDiagramId(null)}
              folderActions={folderActions}
              onStartRenameDiagram={(id) => setRenamingDiagramId(id)}
              onDuplicateDiagram={(id) => void duplicateDiagram(id)}
              onDeleteDiagram={deleteDiagram}
              onMoveDiagram={openMovePickerForDiagram}
              childrenCount={(id) => childrenByParent.get(id)?.length ?? 0}
              diagramsCount={(id) => diagramsByFolder.get(id)?.length ?? 0}
            />
          )}
        </section>
      </main>

      {moveTarget ? (
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTarget(null)}
        >
          <MenuItem
            icon={<MenuFolderIcon />}
            label="All diagrams"
            onClick={() => {
              if (moveTarget.kind === 'diagram') moveDiagramToFolder(moveTarget.id, null);
              else moveFolderToParent(moveTarget.id, null);
              setMoveTarget(null);
            }}
          />
          {movePickerRows.map((row) => (
            <MenuItem
              key={row.id}
              icon={<MenuFolderIcon />}
              label={row.path}
              onClick={() => {
                if (moveTarget.kind === 'diagram') moveDiagramToFolder(moveTarget.id, row.id);
                else moveFolderToParent(moveTarget.id, row.id);
                setMoveTarget(null);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
      {searchOpen ? (
        <SearchPanel
          diagrams={diagrams.map((d) => ({ id: d.id, name: d.name }))}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          onSelectDiagram={(id) => {
            window.location.assign(`/live/diagram/${id}`);
          }}
          onSelectFolder={(id) => {
            setSelected({ kind: 'folder', id });
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}
