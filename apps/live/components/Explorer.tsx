'use client';

import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { MovablePanel } from './MovablePanel';
import { MenuItem, PortalMenu } from './PortalMenu';
import { SignInPrompt } from './SignInPrompt';
import { Tooltip } from './Tooltip';

type DiagramListItem = {
  id: string;
  name: string;
  folderId: string | null;
  savedAt: number;
};

type FolderItem = {
  id: string;
  parentId: string | null;
  name: string;
};

// "Shared with you" entry — a diagram the visitor previously opened
// via a share link, surfaced by `/api/shared` so the Explorer can
// list it alongside their owned diagrams without the visitor having
// to bookmark the share URL. Visitor's resolved owner is the
// implicit key; rows live in the api worker's `shared_with` table.
type SharedItem = {
  id: string;
  name: string;
  savedAt: number;
  role: 'edit' | 'view';
  // Still-live share code for the visitor's role — needed so the
  // row click can navigate to `/live/diagram/<id>?s=<code>`, which
  // is the only path a non-owner can actually open the diagram on.
  shareCode: string;
};

type ExplorerProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  // Every diagram known to the local store. Current diagram is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  diagrams: DiagramListItem[];
  // Every folder for the owner. Empty array = no user folders, but
  // the synthetic Unsorted bucket still renders. See spec/15.
  folders: FolderItem[];
  // Diagrams shared with the current owner (read-only or edit
  // visitor entries). Empty array hides the section entirely so
  // pure-private users don't see an empty accordion.
  shared?: SharedItem[];
  // Dismiss a single Shared row — drops the shared_with reference
  // server-side so the row no longer surfaces. Optional so consumers
  // that haven't wired the api endpoint can omit it.
  onDismissShared?: (diagramId: string) => void;
  // Navigate to the standalone /live/explorer page. When set, the
  // panel header surfaces an "Expand" button next to the title.
  // Optional because pure-guest surfaces (no Clerk) could leave it
  // off — the standalone route gates itself with a sign-in CTA
  // either way, so passing it is safe even when the user isn't
  // signed in.
  onOpenFullExplorer?: () => void;
  // True while the initial diagram-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // diagrams" before the API call resolves.
  loading: boolean;
  currentDiagramId: string | null;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onReset: () => void;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  // Optional so consumers that have nowhere to mint a new diagram
  // (e.g. the welcome route, which IS the new-diagram flow) can hide
  // the button entirely. When omitted the row isn't rendered.
  onNewDiagram?: () => void;
  // Optional row-level actions. When provided, each row renders an
  // ellipsis menu that delegates to these handlers.
  onRenameCurrent?: (name: string) => void;
  onDeleteDiagram?: (id: string) => void;
  onDuplicateDiagram?: (id: string) => void;
  // Folder mutations. Optional so read-only surfaces can omit them.
  onCreateFolder?: (input: { name: string; parentId: string | null }) => Promise<FolderItem | void>;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
};

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
export function Explorer({
  position,
  minimized,
  diagrams,
  folders,
  loading,
  currentDiagramId,
  onMoveTo,
  onToggleMinimized,
  onReset,
  onOpenDiagram,
  onNewDiagram,
  onRenameCurrent,
  onDeleteDiagram,
  onDuplicateDiagram,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDiagramToFolder,
  shared = [],
  onDismissShared,
  onOpenFullExplorer,
}: ExplorerProps) {
  const [sharedOpen, setSharedOpen] = useState(false);
  // Re-render every 30s so the "Updated X ago" strings stay fresh
  // while the panel is open. Cheap when the panel is minimised (this
  // function returns early below before the interval is set up).
  useRelativeTimeTick();
  // Default to collapsed so the panel stays compact when the user
  // has lots of diagrams. The header badge surfaces the count even
  // when the list isn't visible.
  const [recentOpen, setRecentOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  // Expansion state for each folder node + Unsorted (keyed by
  // folder id, or the literal 'unsorted' for the synthetic bucket).
  // Defaults to all collapsed so the panel stays compact on load.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // When set, the diagram row whose Move menu is open. Stored here
  // (vs. in DiagramRow) so the picker portals don't nest.
  const [moveTargetDiagramId, setMoveTargetDiagramId] = useState<string | null>(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);
  // Folder id newly created via the New folder button — used to drop
  // the row into rename mode immediately after the API returns.
  const [pendingRenameFolderId, setPendingRenameFolderId] = useState<string | null>(null);
  // Diagrams currently mid slide-out animation. Adding the id to this
  // set switches the row's <li> className from animate-slide-row-in to
  // animate-slide-row-out for ~220ms, then we forward the real delete
  // to the parent so the row is removed from the underlying
  // `diagrams` prop. Without the delay the row disappears instantly
  // and a fresh "5 with the same name" Explorer feels unresponsive.
  const [exitingDiagramIds, setExitingDiagramIds] = useState<Set<string>>(new Set());
  const wrappedDeleteDiagram = onDeleteDiagram
    ? (id: string) => {
        setExitingDiagramIds((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        window.setTimeout(() => {
          onDeleteDiagram(id);
          setExitingDiagramIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 220);
      }
    : undefined;

  if (minimized) return null;

  const current = currentDiagramId
    ? (diagrams.find((d) => d.id === currentDiagramId) ?? null)
    : null;
  // Cap the recents list at 5 so the accordion stays compact.
  const RECENT_LIMIT = 5;
  const allOthers = [...diagrams]
    .filter((d) => d.id !== currentDiagramId)
    .sort((a, b) => b.savedAt - a.savedAt);
  const recents = allOthers.slice(0, RECENT_LIMIT);

  // Folder tree: index folders by parentId so the recursive renderer
  // can ask for children by id without rescanning the full list.
  const foldersByParent = new Map<string | null, FolderItem[]>();
  for (const f of folders) {
    const bucket = foldersByParent.get(f.parentId) ?? [];
    bucket.push(f);
    foldersByParent.set(f.parentId, bucket);
  }
  for (const bucket of foldersByParent.values())
    bucket.sort((a, b) => a.name.localeCompare(b.name));

  const diagramsByFolder = new Map<string | null, DiagramListItem[]>();
  for (const d of diagrams) {
    const bucket = diagramsByFolder.get(d.folderId) ?? [];
    bucket.push(d);
    diagramsByFolder.set(d.folderId, bucket);
  }
  for (const bucket of diagramsByFolder.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);

  // Flat list of every folder with its breadcrumb path. Used as the
  // "Move to folder…" picker options. Built depth-first so children
  // appear under their parents in the dropdown.
  const folderPathPicker: { id: string; path: string }[] = [];
  const walk = (parentId: string | null, prefix: string[]) => {
    for (const f of foldersByParent.get(parentId) ?? []) {
      const path = [...prefix, f.name];
      folderPathPicker.push({ id: f.id, path: path.join(' / ') });
      walk(f.id, path);
    }
  };
  walk(null, []);

  const toggleFolder = (key: string) =>
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCreateRoot = async () => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId: null });
    if (folder) {
      setFoldersOpen(true);
      setPendingRenameFolderId(folder.id);
    }
  };

  const handleCreateChild = async (parentId: string) => {
    if (!onCreateFolder) return;
    const folder = await onCreateFolder({ name: 'New folder', parentId });
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
      setPendingRenameFolderId(folder.id);
    }
  };

  const openMovePicker = (diagramId: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTargetDiagramId(diagramId);
  };

  return (
    <MovablePanel
      title="Explorer"
      position={position}
      defaultCorner="top-left"
      width="w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
        {onNewDiagram ? (
          <button
            type="button"
            onClick={onNewDiagram}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-400 hover:bg-brand-100"
          >
            <PlusIcon />
            New diagram
          </button>
        ) : null}

        {current ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/70 bg-white p-2 shadow-sm">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              <li
                className={
                  exitingDiagramIds.has(current.id)
                    ? 'animate-slide-row-out overflow-hidden'
                    : 'animate-slide-row-in overflow-hidden'
                }
              >
                <DiagramRow
                  item={current}
                  active
                  onOpen={() => onOpenDiagram(current.id)}
                  onRename={onRenameCurrent}
                  onDelete={
                    wrappedDeleteDiagram ? () => wrappedDeleteDiagram(current.id) : undefined
                  }
                  onDuplicate={
                    onDuplicateDiagram ? () => onDuplicateDiagram(current.id) : undefined
                  }
                  onMoveRequest={
                    onMoveDiagramToFolder
                      ? (anchor) => openMovePicker(current.id, anchor)
                      : undefined
                  }
                />
              </li>
            </ul>
          </div>
        ) : null}

        {loading || recents.length > 0 ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/70 bg-white p-2 shadow-sm">
            <AccordionHeader
              label="Recent"
              badge={loading ? null : recents.length}
              open={recentOpen}
              onToggle={() => setRecentOpen((v) => !v)}
            />
            {recentOpen ? (
              loading ? (
                <ul className="flex flex-col gap-1" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                      aria-hidden
                    >
                      <span className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-slate-200" />
                      <span
                        className="h-3 animate-pulse rounded bg-slate-200"
                        style={{ width: `${70 - i * 12}%` }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="scrollbar-slim flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                  {recents.map((d) => (
                    <li
                      key={d.id}
                      className={
                        exitingDiagramIds.has(d.id)
                          ? 'animate-slide-row-out overflow-hidden'
                          : 'animate-slide-row-in overflow-hidden'
                      }
                    >
                      <DiagramRow
                        item={d}
                        active={false}
                        onOpen={() => onOpenDiagram(d.id)}
                        onDelete={
                          wrappedDeleteDiagram ? () => wrappedDeleteDiagram(d.id) : undefined
                        }
                        onDuplicate={
                          onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined
                        }
                        onMoveRequest={
                          onMoveDiagramToFolder
                            ? (anchor) => openMovePicker(d.id, anchor)
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        {/* Shared-with-you accordion. Only renders when the api has
            surfaced at least one entry — empty state would just be
            a noisy "Shared (0)" line on every user's first ever
            session. Entries come from the shared_with table
            (migration 0010) — bumped every time the visitor opens
            a share link for a diagram they don't own. */}
        {shared.length > 0 ? (
          <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/70 bg-white p-2 shadow-sm">
            <AccordionHeader
              label="Shared with you"
              badge={shared.length}
              open={sharedOpen}
              onToggle={() => setSharedOpen((v) => !v)}
            />
            {sharedOpen ? (
              <ul className="flex flex-col gap-0.5">
                {shared.map((s) => (
                  <SharedRow
                    key={s.id}
                    item={s}
                    active={s.id === currentDiagramId}
                    onOpen={() => onOpenDiagram(s.id, s.shareCode)}
                    onDismiss={onDismissShared ? () => onDismissShared(s.id) : undefined}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Folders section (spec/15). Always shows because Unsorted
            is the home for any uncategorised diagram, so there's
            always at least one bucket. */}
        <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/70 bg-white p-2 shadow-sm">
          <AccordionHeader
            label="Folders"
            badge={folders.length}
            open={foldersOpen}
            onToggle={() => setFoldersOpen((v) => !v)}
            trailing={
              onCreateFolder ? (
                <Tooltip title="New folder" description="Add a root-level folder.">
                  <button
                    type="button"
                    aria-label="New folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCreateRoot();
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <PlusIcon />
                  </button>
                </Tooltip>
              ) : null
            }
          />
          {foldersOpen ? (
            <ul className="flex flex-col gap-0.5">
              {(foldersByParent.get(null) ?? []).map((f) => (
                <FolderNode
                  key={f.id}
                  folder={f}
                  depth={0}
                  foldersByParent={foldersByParent}
                  diagramsByFolder={diagramsByFolder}
                  expanded={expandedFolders}
                  onToggleExpanded={toggleFolder}
                  currentDiagramId={currentDiagramId}
                  pendingRenameId={pendingRenameFolderId}
                  onRenameFolderCommitted={() => setPendingRenameFolderId(null)}
                  onOpenDiagram={onOpenDiagram}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  onCreateChild={handleCreateChild}
                  onDeleteDiagram={wrappedDeleteDiagram}
                  exitingDiagramIds={exitingDiagramIds}
                  onDuplicateDiagram={onDuplicateDiagram}
                  onMoveDiagramRequest={
                    onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                  }
                />
              ))}
              {(diagramsByFolder.get(null) ?? []).length > 0 ? (
                <UnsortedNode
                  expanded={expandedFolders}
                  onToggleExpanded={toggleFolder}
                  diagrams={diagramsByFolder.get(null) ?? []}
                  currentDiagramId={currentDiagramId}
                  onOpenDiagram={onOpenDiagram}
                  onDeleteDiagram={wrappedDeleteDiagram}
                  exitingDiagramIds={exitingDiagramIds}
                  onDuplicateDiagram={onDuplicateDiagram}
                  onMoveDiagramRequest={
                    onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                  }
                />
              ) : null}
            </ul>
          ) : null}
        </div>

        {onOpenFullExplorer ? (
          <button
            type="button"
            onClick={onOpenFullExplorer}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
          >
            <ExpandIcon />
            Open Explorer
          </button>
        ) : null}

        <SignInPrompt />
      </div>

      {moveTargetDiagramId && onMoveDiagramToFolder ? (
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTargetDiagramId(null)}
        >
          <MenuItem
            icon={<UnsortedIcon />}
            label="Unsorted"
            onClick={() => {
              onMoveDiagramToFolder(moveTargetDiagramId, null);
              setMoveTargetDiagramId(null);
            }}
          />
          {folderPathPicker.map((f) => (
            <MenuItem
              key={f.id}
              icon={<FolderIcon />}
              label={f.path}
              onClick={() => {
                onMoveDiagramToFolder(moveTargetDiagramId, f.id);
                setMoveTargetDiagramId(null);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </MovablePanel>
  );
}

// Recursive folder row. Each node owns its own ellipsis menu;
// expanding the node reveals child folders (recursive) + the
// diagrams in this folder (DiagramRow).
function FolderNode({
  folder,
  depth,
  foldersByParent,
  diagramsByFolder,
  expanded,
  onToggleExpanded,
  currentDiagramId,
  pendingRenameId,
  onRenameFolderCommitted,
  onOpenDiagram,
  onRenameFolder,
  onDeleteFolder,
  onCreateChild,
  onDeleteDiagram,
  exitingDiagramIds,
  onDuplicateDiagram,
  onMoveDiagramRequest,
}: {
  folder: FolderItem;
  depth: number;
  foldersByParent: Map<string | null, FolderItem[]>;
  diagramsByFolder: Map<string | null, DiagramListItem[]>;
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  currentDiagramId: string | null;
  pendingRenameId: string | null;
  onRenameFolderCommitted: () => void;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild: (parentId: string) => Promise<void> | void;
  onDeleteDiagram?: (id: string) => void;
  // Set of diagram ids currently mid slide-out animation. Passed
  // down from the Explorer's wrappedDeleteDiagram so every row in
  // the tree can apply the matching animation class.
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
}) {
  const isExpanded = expanded[folder.id] ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const childFolders = foldersByParent.get(folder.id) ?? [];
  const childDiagrams = diagramsByFolder.get(folder.id) ?? [];
  const childCount = childFolders.length + childDiagrams.length;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-enter rename mode for freshly-created folders.
  useEffect(() => {
    if (pendingRenameId === folder.id) {
      setEditing(true);
      onRenameFolderCommitted();
    }
  }, [pendingRenameId, folder.id, onRenameFolderCommitted]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== folder.name && onRenameFolder) onRenameFolder(folder.id, next);
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(folder.name);
    setEditing(false);
  };

  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400">
          <FolderIcon />
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
            }}
            className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 outline-none focus:border-brand-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => onToggleExpanded(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
          >
            <span className="truncate">{folder.name}</span>
            <span className="text-[10px] font-medium text-slate-400">{childCount}</span>
          </button>
        )}
        {!editing ? (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label="Folder menu"
            aria-expanded={menuOpen}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200/70 hover:text-slate-700 ${
              menuOpen ? 'opacity-100' : ''
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
              <circle cx="3" cy="7" r="1.25" fill="currentColor" />
              <circle cx="7" cy="7" r="1.25" fill="currentColor" />
              <circle cx="11" cy="7" r="1.25" fill="currentColor" />
            </svg>
          </button>
        ) : null}
        {menuOpen ? (
          <PortalMenu
            anchor={menuButtonRef.current}
            placement="below"
            onClose={() => setMenuOpen(false)}
          >
            {onRenameFolder ? (
              <MenuItem
                icon={<PencilIcon />}
                label="Rename"
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
              />
            ) : null}
            <MenuItem
              icon={<PlusIcon />}
              label="New subfolder"
              onClick={() => {
                void onCreateChild(folder.id);
                setMenuOpen(false);
              }}
            />
            {onDeleteFolder ? (
              <MenuItem
                icon={<TrashIcon />}
                label="Delete"
                danger
                onClick={() => {
                  onDeleteFolder(folder.id);
                  setMenuOpen(false);
                }}
              />
            ) : null}
          </PortalMenu>
        ) : null}
      </div>
      {isExpanded ? (
        <ul className="flex flex-col gap-0.5">
          {childFolders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              foldersByParent={foldersByParent}
              diagramsByFolder={diagramsByFolder}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              currentDiagramId={currentDiagramId}
              pendingRenameId={pendingRenameId}
              onRenameFolderCommitted={onRenameFolderCommitted}
              onOpenDiagram={onOpenDiagram}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateChild={onCreateChild}
              onDeleteDiagram={onDeleteDiagram}
              exitingDiagramIds={exitingDiagramIds}
              onDuplicateDiagram={onDuplicateDiagram}
              onMoveDiagramRequest={onMoveDiagramRequest}
            />
          ))}
          {childDiagrams.map((d) => (
            <li
              key={d.id}
              style={{ paddingLeft: 4 + (depth + 1) * 12 }}
              className={
                exitingDiagramIds.has(d.id)
                  ? 'animate-slide-row-out overflow-hidden'
                  : 'animate-slide-row-in overflow-hidden'
              }
            >
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={onDeleteDiagram ? () => onDeleteDiagram(d.id) : undefined}
                onDuplicate={onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined}
                onMoveRequest={
                  onMoveDiagramRequest ? (anchor) => onMoveDiagramRequest(d.id, anchor) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// Synthetic root-level "Unsorted" folder. Holds every diagram with
// folder_id IS NULL. Can't be renamed or deleted.
function UnsortedNode({
  expanded,
  onToggleExpanded,
  diagrams,
  currentDiagramId,
  onOpenDiagram,
  onDeleteDiagram,
  exitingDiagramIds,
  onDuplicateDiagram,
  onMoveDiagramRequest,
}: {
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onDeleteDiagram?: (id: string) => void;
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
}) {
  const isExpanded = expanded['unsorted'] ?? false;
  return (
    <li>
      <div className="flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100">
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Unsorted' : 'Expand Unsorted'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400">
          <UnsortedIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
        >
          <span className="truncate italic text-slate-500">Unsorted</span>
          <span className="text-[10px] font-medium text-slate-400">{diagrams.length}</span>
        </button>
      </div>
      {isExpanded ? (
        <ul className="flex flex-col gap-0.5">
          {diagrams.map((d) => (
            <li
              key={d.id}
              style={{ paddingLeft: 16 }}
              className={
                exitingDiagramIds.has(d.id)
                  ? 'animate-slide-row-out overflow-hidden'
                  : 'animate-slide-row-in overflow-hidden'
              }
            >
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={onDeleteDiagram ? () => onDeleteDiagram(d.id) : undefined}
                onDuplicate={onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined}
                onMoveRequest={
                  onMoveDiagramRequest ? (anchor) => onMoveDiagramRequest(d.id, anchor) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// One row in the "Shared with you" accordion. Visually similar to
// the recents list but stripped of folder / move / duplicate menu
// affordances — the visitor doesn't own these diagrams, so the
// only meaningful actions are "open" and "dismiss this row from my
// list." A small role pill ("View" / "Edit") communicates what they
// can do once they're in.
function SharedRow({
  item,
  active,
  onOpen,
  onDismiss,
}: {
  item: SharedItem;
  active: boolean;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  useRelativeTimeTick();
  const relative = formatRelativeTime(Date.now() - item.savedAt);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${
          active ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <span className={active ? 'text-brand-500' : 'text-slate-400'}>
          <SharedDiagramIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{item.name}</span>
          <span className="block truncate text-[10px] text-slate-500">
            {item.role === 'edit' ? 'Edit · ' : 'View · '}
            Updated {relative}
          </span>
        </span>
      </button>
      {onDismiss ? (
        <div className="absolute right-1.5 top-1.5 hidden group-hover:block group-focus-within:block">
          <Tooltip title="Remove" description="Drop this from your Shared list.">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label={`Remove ${item.name} from Shared`}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              <RemoveIcon />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </li>
  );
}

function SharedDiagramIcon() {
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
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11" />
      <path d="M10 9.5l2 2-2 2" />
      <path d="M12 11.5h-4" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

// Accordion header used for top-level sections. Trailing slot lets
// callers tuck extra controls (e.g. "New folder") into the header
// next to the badge.
function AccordionHeader({
  label,
  badge,
  open,
  onToggle,
  trailing,
}: {
  label: string;
  badge: number | null;
  open: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    // Order: [Chevron Label ……] [trailing +] [badge].
    // The badge sits to the right of any trailing action so the
    // primary action (e.g. "new folder") is closer to where the user
    // already has the cursor after expanding the accordion. The
    // toggle button keeps everything inside it that the user might
    // misclick onto — but the badge is purely informational and
    // doesn't need to react to a row-level toggle, so it lives
    // outside.
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-slate-100"
      >
        <span
          className={`inline-block transition-transform ${open ? 'rotate-90' : 'rotate-0'}`}
          aria-hidden
        >
          <ChevronIcon />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </button>
      {trailing}
      {badge !== null ? (
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden
    >
      <path d="M3 1.5L6 4.5L3 7.5" />
    </svg>
  );
}

// Single diagram entry. Acts as both the Current Diagram row (active
// state, optional inline rename) and a Recent Diagrams row (Open /
// Delete / Duplicate / Move menu).
function DiagramRow({
  item,
  active,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onMoveRequest,
}: {
  item: DiagramListItem;
  active: boolean;
  onOpen: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  // Asks the parent Explorer to open the "Move to folder…" picker
  // anchored to the supplied element. Stored at the panel level so
  // the portal isn't nested inside another PortalMenu.
  onMoveRequest?: (anchor: HTMLElement | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(item.name);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== item.name && onRename) onRename(next);
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(item.name);
    setEditing(false);
  };

  const hasMenu = Boolean((onRename && active) || onDelete || onDuplicate || onMoveRequest);
  const relative = formatRelativeTime(Date.now() - item.savedAt);

  const pillClasses = active
    ? 'group flex items-stretch rounded-md bg-brand-100 text-brand-800'
    : 'group flex items-stretch rounded-md text-slate-700 transition hover:bg-slate-100';

  return (
    <div className={pillClasses}>
      <button
        type="button"
        onClick={editing ? undefined : onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex flex-1 items-start gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-left text-xs ${active ? 'font-medium' : ''}`}
      >
        <span className="mt-0.5">
          <DiagramIcon active={active} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 outline-none focus:border-brand-500"
            />
          ) : (
            <span className="truncate">{item.name}</span>
          )}
          <Tooltip title="Last updated" description={new Date(item.savedAt).toLocaleString()}>
            <span
              className={
                active
                  ? 'truncate text-[10px] font-normal text-brand-700/80'
                  : 'truncate text-[10px] text-slate-400'
              }
            >
              Updated {relative}
            </span>
          </Tooltip>
        </span>
      </button>
      {hasMenu && !editing ? (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Diagram menu"
          aria-expanded={menuOpen}
          className={`mr-1 flex w-6 shrink-0 items-center justify-center self-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200/70 hover:text-slate-700 ${
            menuOpen ? 'opacity-100' : ''
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="3" cy="7" r="1.25" fill="currentColor" />
            <circle cx="7" cy="7" r="1.25" fill="currentColor" />
            <circle cx="11" cy="7" r="1.25" fill="currentColor" />
          </svg>
        </button>
      ) : null}
      {menuOpen ? (
        <PortalMenu
          anchor={menuButtonRef.current}
          placement="below"
          onClose={() => setMenuOpen(false)}
        >
          {!active ? (
            <MenuItem
              icon={<OpenIcon />}
              label="Open"
              onClick={() => {
                onOpen();
                setMenuOpen(false);
              }}
            />
          ) : null}
          {active && onRename ? (
            <MenuItem
              icon={<PencilIcon />}
              label="Rename"
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
            />
          ) : null}
          {onDuplicate ? (
            <MenuItem
              icon={<DuplicateIcon />}
              label="Duplicate"
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
            />
          ) : null}
          {onMoveRequest ? (
            <MenuItem
              icon={<FolderIcon />}
              label="Move to folder…"
              onClick={() => {
                onMoveRequest(menuButtonRef.current);
                setMenuOpen(false);
              }}
            />
          ) : null}
          {onDelete ? (
            <MenuItem
              icon={<TrashIcon />}
              label="Delete"
              danger
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
    </div>
  );
}

function DiagramIcon({ active }: { active: boolean }) {
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
      className={active ? 'text-brand-600' : 'text-slate-400'}
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4h3l1 1h6.5v5.5h-10.5z" />
      <path d="M3.5 4V3h3" />
    </svg>
  );
}

function UnsortedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 3.5h10v7h-10z" strokeDasharray="2 2" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}

function DuplicateIcon() {
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
      <rect x="5" y="5" width="8" height="8" rx="1.25" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </svg>
  );
}

function OpenIcon() {
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
      <path d="M9.5 2.5h4v4" />
      <path d="M13 3L7.5 8.5" />
      <path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

function ExpandIcon() {
  // Diagonal-arrow-out glyph — "open this in a bigger surface". Same
  // 9px size + 1.6 stroke as ChevronIcon so the panel header chrome
  // stays visually consistent.
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 1.5h-3v3" />
      <path d="M7.5 10.5h3v-3" />
      <path d="M1.5 1.5l4 4" />
      <path d="M10.5 10.5l-4-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

export function ExplorerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5h6.5A1.5 1.5 0 0 1 17 6.5v8A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5z" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="3" width="6" height="6" rx="1.25" />
      <rect x="11" y="3" width="6" height="6" rx="1.25" />
      <rect x="3" y="11" width="6" height="6" rx="1.25" />
      <rect x="11" y="11" width="6" height="6" rx="1.25" />
    </svg>
  );
}
