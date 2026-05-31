'use client';

import Link from 'next/link';
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
import { clerkEnabled } from '@/lib/clerk-config';
import { useFolders } from '@/hooks/useFolders';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { MenuItem, PortalMenu } from '@/components/PortalMenu';
import { InlineRenameInput } from '@/components/InlineRenameInput';

type DiagramItem = { id: string; name: string; folderId: string | null; savedAt: number };

// What the sidebar tree highlights and what the right pane shows.
// "Special" nodes (`recent`, `all`, `shared`) are virtual buckets
// with no folder row behind them; `folder` is a real owned folder.
type SelectedNode =
  | { kind: 'recent' }
  | { kind: 'all' }
  | { kind: 'unsorted' }
  | { kind: 'shared' }
  | { kind: 'folder'; id: string };

// "Recent" cap. Big enough for "what was I just working on",
// small enough that it doesn't drown the list view.
const RECENT_LIMIT = 12;

// Sidebar width. Wide enough for ~3 levels of indented folder names,
// narrow enough that the list view keeps its breathing room.
const SIDEBAR_WIDTH = 256;

// Indent step per tree level. Matches the Windows Explorer visual
// of a chevron + folder glyph + name with each child nudged in.
const INDENT_STEP = 16;

// Full-page Explorer (item #12). Signed-in only — guests still have
// the floating Explorer panel on the editor / new-diagram routes,
// but the standalone page is gated on Clerk because the value of
// the dedicated page is "see everything I own across devices," and
// pure-guest identity is per-browser by definition. The non-Clerk
// deployment renders a permanent "auth not configured" notice (per
// spec/04's three-deployment-modes table).
//
// Layout shape (spec/15): split view — sidebar tree on the left for
// navigation, breadcrumb + list view on the right for the focused
// folder's contents. Subfolders nest in both panes; selecting a
// folder in the tree or double-clicking a folder row drills in.
export default function ExplorerPage() {
  const { authLoaded, isSignedIn, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const {
    folders,
    createFolder: hookCreateFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders(clerkUserId ?? null, { autoLoad: false });
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
  // FAB popover: "+ New diagram" / "+ New folder".
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  // What the tree highlights + right pane shows. Defaults to "All
  // diagrams" (the root) so the first impression is the full library
  // — Recent is one sidebar click away.
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'all' });
  // Which folder branches are open in the sidebar. Local state only;
  // a fresh visit starts with the root open and everything else
  // collapsed (Windows Explorer pattern).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    document.title = 'Explorer | livediagram';
  }, []);

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
    if (!isSignedIn || !clerkUserId) {
      setLoading(false);
      return;
    }
    void refresh(clerkUserId);
  }, [authLoaded, isSignedIn, clerkUserId, refresh]);

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
    if (!clerkUserId) return;
    // No-op if we'd be moving into ourselves or a descendant — the
    // picker already filters these, this is belt-and-braces.
    if (parentId && descendantSet(id).has(parentId)) return;
    void apiUpdateFolder(clerkUserId, id, { parentId }).catch(() => {});
    // Optimistic: rewrite the folder row's parentId locally. The
    // useFolders hook owns the canonical state; we reach in via
    // `setFolders` — but that's not exposed by the hook... so kick
    // a refresh after the mutation lands instead. Folder moves are
    // rare enough that one extra round-trip is fine.
    void refreshFolders();
  };

  const renameDiagram = (id: string, name: string) => {
    if (!clerkUserId) return;
    const trimmed = name.trim();
    setRenamingDiagramId(null);
    if (!trimmed) return;
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveDiagramMeta(clerkUserId, { id, name: trimmed }).catch(() => {});
  };

  const deleteDiagram = (id: string) => {
    if (!clerkUserId) return;
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(clerkUserId, id).catch(() => {});
  };

  const moveDiagramToFolder = (id: string, folderId: string | null) => {
    if (!clerkUserId) return;
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(clerkUserId, id, folderId).catch(() => {});
  };

  const duplicateDiagram = async (id: string) => {
    if (!clerkUserId) return;
    await duplicate(clerkUserId, id);
    const list = await apiListDiagrams(clerkUserId).catch(() => null);
    if (list) setDiagrams(list);
  };

  const dismissShared = (diagramId: string) => {
    if (!clerkUserId) return;
    setShared((prev) => prev.filter((s) => s.id !== diagramId));
    void apiDismissSharedWith(clerkUserId, diagramId).catch(() => {});
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

  // ---- Early returns -------------------------------------------
  if (!clerkEnabled) {
    return (
      <FullPageNotice
        title="Explorer needs auth"
        body="This deployment was built without Clerk, so there's no signed-in workspace to show here. The floating Explorer on the editor still works for per-browser guest sessions."
        cta={{ href: '/live/', label: 'Back to editor' }}
      />
    );
  }
  if (!authLoaded) return null;
  if (!isSignedIn) {
    return (
      <FullPageNotice
        title="Sign in to see your Explorer"
        body="Your owned diagrams, folders, and the diagrams others have shared with you all live here once you sign in."
        cta={{ href: '/live/sign-in/', label: 'Sign in' }}
      />
    );
  }

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
    delete: () => {
      // Mirror the server's ON DELETE SET NULL locally: any diagram
      // sitting in this folder (or any descendant of it) returns to
      // Unsorted. The useFolders hook already re-parents descendant
      // folders, but it doesn't touch diagrams — so without this
      // sweep, locally-cached diagrams hold a folderId pointing at a
      // row that no longer exists until the next list refresh.
      const dropped = descendantSet(f.id);
      setDiagrams((prev) =>
        prev.map((d) => (d.folderId && dropped.has(d.folderId) ? { ...d, folderId: null } : d)),
      );
      deleteFolder(f.id);
      // If the currently-selected node is the one being deleted (or
      // a descendant of it), promote selection back to "All diagrams"
      // so the right pane doesn't keep pointing at a phantom folder.
      if (selected.kind === 'folder' && dropped.has(selected.id)) {
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 pb-16 pt-6">
        {/* ---------- Sidebar tree ---------- */}
        <aside
          className="shrink-0 self-start"
          style={{ width: SIDEBAR_WIDTH }}
          aria-label="Folders"
        >
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white px-2 py-3 shadow-sm">
            <SidebarSectionLabel first>Hi {clerkDisplayName ?? 'there'}</SidebarSectionLabel>
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

            {shared.length > 0 ? (
              <>
                <SidebarSectionLabel>Shared</SidebarSectionLabel>
                <SidebarRow
                  icon={<ShareIcon />}
                  label="Shared with me"
                  selected={selected.kind === 'shared'}
                  onClick={() => setSelected({ kind: 'shared' })}
                  depth={0}
                  badge={shared.length}
                />
              </>
            ) : null}
          </div>
        </aside>

        {/* ---------- Right pane ---------- */}
        <section className="min-w-0 flex-1">
          <PaneHeader title={paneTitle} crumbs={paneCrumbs} />

          {loading ? (
            <SkeletonRows />
          ) : selected.kind === 'shared' ? (
            <SharedList shared={shared} onDismiss={dismissShared} />
          ) : paneContent.folders.length === 0 &&
            paneContent.diagrams.length === 0 &&
            !paneContent.showUnsortedRow ? (
            <EmptyPane
              selected={selected}
              onCreateDiagram={() =>
                window.location.assign(
                  selected.kind === 'folder' ? `/live/new?folder=${selected.id}` : '/live/new',
                )
              }
              onCreateFolder={() =>
                void createFolder(selected.kind === 'folder' ? selected.id : null)
              }
            />
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

      {/* Floating "+" FAB. Same as before, with the popover offering
          "New diagram" + "New folder". "New folder" creates a child
          of the currently-selected folder (or at root if a special
          node is selected) so subfolder creation is one click away. */}
      <button
        ref={fabRef}
        type="button"
        aria-label="Create"
        aria-expanded={fabMenuOpen}
        onClick={() => setFabMenuOpen((o) => !o)}
        className="fixed bottom-8 right-8 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/40"
      >
        <PlusIcon size={22} />
      </button>
      {fabMenuOpen ? (
        <PortalMenu anchor={fabRef.current} placement="above" onClose={() => setFabMenuOpen(false)}>
          <MenuItem
            icon={<PlusIcon />}
            label="New diagram"
            onClick={() => {
              setFabMenuOpen(false);
              window.location.assign(
                selected.kind === 'folder' ? `/live/new?folder=${selected.id}` : '/live/new',
              );
            }}
          />
          <MenuItem
            icon={<PlusIcon />}
            label={selected.kind === 'folder' ? 'New subfolder' : 'New folder'}
            onClick={() => {
              setFabMenuOpen(false);
              void createFolder(selected.kind === 'folder' ? selected.id : null);
            }}
          />
        </PortalMenu>
      ) : null}

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
    </div>
  );
}

// ---------- Sidebar tree primitives -------------------------------

function SidebarSectionLabel({
  children,
  first,
}: {
  children: React.ReactNode;
  // `first` skips the inter-section gap on the topmost label so the
  // sidebar box has matching breathing room above the first label and
  // below the last row. Without this the top reads as too padded.
  first?: boolean;
}) {
  return (
    <div
      className={`px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
        first ? '' : 'mt-3 pt-1'
      }`}
    >
      {children}
    </div>
  );
}

// One sidebar row. Re-used for the "Recent", "All diagrams", and
// "Shared with me" special entries. Folder rows wrap this via
// SidebarFolderSubtree so they get chevron + recursive rendering.
function SidebarRow({
  icon,
  label,
  selected,
  onClick,
  depth,
  badge,
  hasChildren,
  expanded,
  onToggleExpand,
  trailing,
  renaming,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  depth: number;
  badge?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  trailing?: React.ReactNode;
  // When true, the label area renders as a plain div instead of a
  // <button>, so a child <input> (e.g. inline rename) can take focus
  // without the parent button intercepting it. An input nested inside
  // a button is invalid HTML and browsers steal the input's focus.
  renaming?: boolean;
}) {
  const labelClass = `flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-xs ${
    selected ? 'font-semibold text-brand-700' : 'text-slate-700'
  }`;
  const labelInner = (
    <>
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined ? (
        <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
          {badge}
        </span>
      ) : null}
    </>
  );
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-1 ${selected ? 'bg-brand-50' : 'hover:bg-slate-100'}`}
      style={{ paddingLeft: depth * INDENT_STEP + 4 }}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition ${
          hasChildren ? 'hover:text-slate-700' : 'invisible'
        }`}
        disabled={!hasChildren || !onToggleExpand}
      >
        {hasChildren ? <ChevronIcon open={!!expanded} /> : null}
      </button>
      {renaming ? (
        <div className={labelClass}>{labelInner}</div>
      ) : (
        <button type="button" onClick={onClick} className={labelClass}>
          {labelInner}
        </button>
      )}
      {trailing}
    </div>
  );
}

// Recursive folder subtree in the sidebar. Each row is a SidebarRow
// with the chevron / folder icon, and children render at +1 depth
// when expanded.
function SidebarFolderSubtree({
  folder,
  depth,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
  childrenByParent,
  renamingFolderId,
  onCommitRenameFolder,
  onCancelRenameFolder,
  folderActions,
}: {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: SelectedNode;
  onSelect: (id: string) => void;
  childrenByParent: Map<string | null, Folder[]>;
  renamingFolderId: string | null;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  folderActions: (
    f: Folder,
    anchor: HTMLElement | null,
  ) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(folder.id);
  const isSelected = selected.kind === 'folder' && selected.id === folder.id;
  const renaming = renamingFolderId === folder.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const labelNode = renaming ? (
    <InlineRenameInput
      initial={folder.name}
      onCommit={(name) => onCommitRenameFolder(folder.id, name)}
      onCancel={onCancelRenameFolder}
      className="rounded border border-brand-300 bg-white px-1 py-0 text-xs"
    />
  ) : (
    folder.name
  );

  return (
    <>
      <SidebarRow
        icon={<FolderIcon open={isOpen} />}
        label={labelNode}
        selected={isSelected}
        onClick={() => onSelect(folder.id)}
        depth={depth}
        hasChildren={hasKids}
        expanded={isOpen}
        onToggleExpand={() => onToggleExpand(folder.id)}
        renaming={renaming}
        trailing={
          renaming ? null : (
            <button
              ref={menuRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
              aria-label={`Menu for ${folder.name}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
            >
              <EllipsisIcon />
            </button>
          )
        }
      />
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <FolderMenuItems
            actions={folderActions(folder, menuRef.current)}
            close={() => setMenuOpen(false)}
          />
        </PortalMenu>
      ) : null}
      {isOpen
        ? kids.map((k) => (
            <SidebarFolderSubtree
              key={k.id}
              folder={k}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              selected={selected}
              onSelect={onSelect}
              childrenByParent={childrenByParent}
              renamingFolderId={renamingFolderId}
              onCommitRenameFolder={onCommitRenameFolder}
              onCancelRenameFolder={onCancelRenameFolder}
              folderActions={folderActions}
            />
          ))
        : null}
    </>
  );
}

// ---------- Right pane primitives ---------------------------------

function PaneHeader({
  title,
  crumbs,
}: {
  title: string;
  crumbs: { name: string; onClick?: () => void }[];
}) {
  // A single-item breadcrumb is just the page title in a second
  // place — visually noisy and provides no navigation. Show only
  // when there are actual parents to click back to.
  const showCrumbs = crumbs.length >= 2;
  return (
    <div className="mb-4">
      <h1 className="mb-2 truncate text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      {showCrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm"
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.name}-${i}`} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-1 text-slate-300">
                    ›
                  </span>
                ) : null}
                {c.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1.5 py-0.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="rounded px-1.5 py-0.5 font-medium text-slate-900">{c.name}</span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function ListView({
  folders,
  diagrams,
  showUnsortedRow,
  unsortedCount,
  onOpenUnsorted,
  onOpenFolder,
  onCommitRenameFolder,
  onCancelRenameFolder,
  renamingFolderId,
  renamingDiagramId,
  onCommitRenameDiagram,
  onCancelRenameDiagram,
  folderActions,
  onStartRenameDiagram,
  onDuplicateDiagram,
  onDeleteDiagram,
  onMoveDiagram,
  childrenCount,
  diagramsCount,
}: {
  folders: Folder[];
  diagrams: DiagramItem[];
  // True on the "All diagrams" view: the synthetic Unsorted row
  // renders at the very top so the root has the same "folder row
  // per child" feel as any non-root folder. The row is only
  // surfaced when there's something to put in it (unsortedCount > 0)
  // to avoid showing an empty folder by default.
  showUnsortedRow: boolean;
  unsortedCount: number;
  onOpenUnsorted: () => void;
  onOpenFolder: (id: string) => void;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  renamingFolderId: string | null;
  renamingDiagramId: string | null;
  onCommitRenameDiagram: (id: string, name: string) => void;
  onCancelRenameDiagram: () => void;
  folderActions: (
    f: Folder,
    anchor: HTMLElement | null,
  ) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
  onStartRenameDiagram: (id: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onMoveDiagram: (id: string, anchor: HTMLElement | null) => void;
  childrenCount: (id: string) => number;
  diagramsCount: (id: string) => number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Name</span>
        <span>Updated</span>
        <span aria-hidden></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {showUnsortedRow ? <UnsortedRow count={unsortedCount} onOpen={onOpenUnsorted} /> : null}
        {folders.map((f) => (
          <FolderRow
            key={f.id}
            folder={f}
            renaming={renamingFolderId === f.id}
            childCount={childrenCount(f.id) + diagramsCount(f.id)}
            onOpen={() => onOpenFolder(f.id)}
            onCommitRename={(name) => onCommitRenameFolder(f.id, name)}
            onCancelRename={onCancelRenameFolder}
            getActionsForAnchor={(anchor) => folderActions(f, anchor)}
          />
        ))}
        {diagrams.map((d) => (
          <DiagramRow
            key={d.id}
            diagram={d}
            renaming={renamingDiagramId === d.id}
            onStartRename={() => onStartRenameDiagram(d.id)}
            onCommitRename={(name) => onCommitRenameDiagram(d.id, name)}
            onCancelRename={onCancelRenameDiagram}
            onDuplicate={() => onDuplicateDiagram(d.id)}
            onDelete={() => onDeleteDiagram(d.id)}
            onMove={(anchor) => onMoveDiagram(d.id, anchor)}
          />
        ))}
      </ul>
    </div>
  );
}

// Synthetic "Unsorted" folder row for the All-diagrams list view.
// Looks like a regular folder row (folder glyph + name + child
// count) but has no rename / move / new-subfolder / delete actions
// because the row isn't backed by a folders table entry — Unsorted
// is the absence of a parent. Clicking drills into the Unsorted
// pseudo-folder which lists every diagram with folder_id IS NULL.
function UnsortedRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      <button
        type="button"
        onDoubleClick={onOpen}
        onClick={onOpen}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <span className="shrink-0 text-slate-400">
          <FolderIcon open={false} />
        </span>
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">
          Unsorted
        </span>
        {count > 0 ? (
          <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
            {count}
          </span>
        ) : null}
      </button>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">—</span>
      <span aria-hidden />
    </li>
  );
}

function FolderRow({
  folder,
  renaming,
  childCount,
  onOpen,
  onCommitRename,
  onCancelRename,
  getActionsForAnchor,
}: {
  folder: Folder;
  renaming: boolean;
  childCount: number;
  onOpen: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  getActionsForAnchor: (anchor: HTMLElement | null) => {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  // When renaming, the label area is a plain div so the <input>
  // inside it isn't nested in a <button> (which steals focus).
  const labelInner = (
    <>
      <span className="shrink-0 text-amber-500">
        <FolderIcon open={false} />
      </span>
      {renaming ? (
        <InlineRenameInput
          initial={folder.name}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
          className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900"
        />
      ) : (
        <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">
          {folder.name}
        </span>
      )}
      {childCount > 0 ? (
        <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
          {childCount}
        </span>
      ) : null}
    </>
  );
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      {renaming ? (
        <div className="flex min-w-0 items-center gap-2">{labelInner}</div>
      ) : (
        <button
          type="button"
          onDoubleClick={onOpen}
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {labelInner}
        </button>
      )}
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {formatRelativeTime(Date.now() - folder.updatedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <button
          ref={menuRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={`Menu for ${folder.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
        >
          <EllipsisIcon />
        </button>
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <FolderMenuItems
            actions={getActionsForAnchor(menuRef.current)}
            close={() => setMenuOpen(false)}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}

function DiagramRow({
  diagram,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onMove,
}: {
  diagram: DiagramItem;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (anchor: HTMLElement | null) => void;
}) {
  useRelativeTimeTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const titleNode = renaming ? (
    <InlineRenameInput
      initial={diagram.name}
      onCommit={onCommitRename}
      onCancel={onCancelRename}
      className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900"
    />
  ) : (
    <Link
      href={`/diagram/${diagram.id}`}
      className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700"
    >
      {diagram.name}
    </Link>
  );

  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-slate-400">
          <DiagramIcon />
        </span>
        {titleNode}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {formatRelativeTime(Date.now() - diagram.savedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <button
          ref={menuRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={`Menu for ${diagram.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
        >
          <EllipsisIcon />
        </button>
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Move to folder…"
            onClick={() => {
              onMove(menuRef.current);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}

function FolderMenuItems({
  actions,
  close,
}: {
  actions: {
    rename: () => void;
    newSubfolder: () => void;
    move: () => void;
    delete: () => void;
  };
  close: () => void;
}) {
  return (
    <>
      <MenuItem
        icon={<MenuPencilIcon />}
        label="Rename"
        onClick={() => {
          actions.rename();
          close();
        }}
      />
      <MenuItem
        icon={<PlusIcon />}
        label="New subfolder"
        onClick={() => {
          actions.newSubfolder();
          close();
        }}
      />
      <MenuItem
        icon={<MenuFolderIcon />}
        label="Move to folder…"
        onClick={() => {
          actions.move();
          close();
        }}
      />
      <MenuItem
        icon={<MenuTrashIcon />}
        label="Delete"
        danger
        onClick={() => {
          actions.delete();
          close();
        }}
      />
    </>
  );
}

function SharedList({
  shared,
  onDismiss,
}: {
  shared: SharedWithItem[];
  onDismiss: (id: string) => void;
}) {
  useRelativeTimeTick();
  if (shared.length === 0) {
    return (
      <EmptyPane
        selected={{ kind: 'shared' }}
        onCreateDiagram={() => window.location.assign('/live/new')}
        onCreateFolder={() => {}}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Name</span>
        <span>Role</span>
        <span>Updated</span>
        <span aria-hidden></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {shared.map((s) => (
          <li
            key={s.id}
            className="group grid grid-cols-[1fr_60px_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50"
          >
            <Link
              href={`/diagram/${s.id}?s=${encodeURIComponent(s.shareCode)}`}
              className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-slate-900 hover:text-brand-700"
            >
              <span className="shrink-0 text-slate-400">
                <DiagramIcon />
              </span>
              <span className="truncate">{s.name}</span>
            </Link>
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              {s.role === 'edit' ? 'Edit' : 'View'}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              {formatRelativeTime(Date.now() - s.savedAt)}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(s.id)}
              aria-label="Dismiss"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-700"
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- States: empty / loading / unauthenticated -------------

function EmptyPane({
  selected,
  onCreateDiagram,
  onCreateFolder,
}: {
  selected: SelectedNode;
  onCreateDiagram: () => void;
  onCreateFolder: () => void;
}) {
  const inFolder = selected.kind === 'folder';
  const isRecent = selected.kind === 'recent';
  const isShared = selected.kind === 'shared';
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-sm text-slate-500">
        {isRecent
          ? "Nothing here yet. Diagrams you've opened will show up here."
          : isShared
            ? "No-one's shared a diagram with you yet."
            : inFolder
              ? 'This folder is empty.'
              : 'No diagrams yet.'}
      </p>
      {isShared ? null : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateDiagram}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            <PlusIcon />
            New diagram
          </button>
          {!isRecent ? (
            <button
              type="button"
              onClick={onCreateFolder}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              <PlusIcon />
              {inFolder ? 'New subfolder' : 'New folder'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <span className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
            <span className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FullPageNotice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Brand href="/" size="md" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

// ---------- Icons -------------------------------------------------

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}
    >
      <path d="M3 2l4 3-4 3" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {open ? (
        <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39h4.05A1.5 1.5 0 0 1 14.5 6.5H1.5v-2zm0 3h13l-.93 4.65a1.5 1.5 0 0 1-1.47 1.2H3.9a1.5 1.5 0 0 1-1.47-1.2L1.5 7.5z" />
      ) : (
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z" />
      )}
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2 1.5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 7.5L8 3l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5z" />
      <path d="M6.5 14V9.5h3V14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M5.8 7l4.4-2.2M5.8 9l4.4 2.2" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="11" cy="7" r="1.25" fill="currentColor" />
    </svg>
  );
}

function MenuPencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z" />
    </svg>
  );
}

function MenuDuplicateIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M2 11V3.5A1.5 1.5 0 0 1 3.5 2H10" />
    </svg>
  );
}

function MenuFolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1 1 0 0 1 .77.37l1 1.24A1 1 0 0 0 8.45 5h4.05A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
    </svg>
  );
}

function MenuTrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.2A1 1 0 0 0 6.1 14h3.8a1 1 0 0 0 1-0.8l.6-9.2" />
    </svg>
  );
}
