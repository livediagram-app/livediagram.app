'use client';

import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { MovablePanel } from './MovablePanel';
import { MenuItem, PortalMenu } from './PortalMenu';
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
  // True while the initial diagram-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // diagrams" before the API call resolves.
  loading: boolean;
  currentDiagramId: string | null;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onReset: () => void;
  onOpenDiagram: (id: string) => void;
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
}: ExplorerProps) {
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
            New Diagram
          </button>
        ) : null}

        {current ? (
          <div className="flex flex-col gap-0.5">
            <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <DiagramRow
                  item={current}
                  active
                  onOpen={() => onOpenDiagram(current.id)}
                  onRename={onRenameCurrent}
                  onDelete={onDeleteDiagram ? () => onDeleteDiagram(current.id) : undefined}
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
          <div className="flex flex-col gap-0.5">
            <AccordionHeader
              label="Recent Diagrams"
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
                    <li key={d.id}>
                      <DiagramRow
                        item={d}
                        active={false}
                        onOpen={() => onOpenDiagram(d.id)}
                        onDelete={onDeleteDiagram ? () => onDeleteDiagram(d.id) : undefined}
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

        {/* Folders section (spec/15). Always shows because Unsorted
            is the home for any uncategorised diagram, so there's
            always at least one bucket. */}
        <div className="flex flex-col gap-0.5">
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
                  onDeleteDiagram={onDeleteDiagram}
                  onDuplicateDiagram={onDuplicateDiagram}
                  onMoveDiagramRequest={
                    onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                  }
                />
              ))}
              <UnsortedNode
                expanded={expandedFolders}
                onToggleExpanded={toggleFolder}
                diagrams={diagramsByFolder.get(null) ?? []}
                currentDiagramId={currentDiagramId}
                onOpenDiagram={onOpenDiagram}
                onDeleteDiagram={onDeleteDiagram}
                onDuplicateDiagram={onDuplicateDiagram}
                onMoveDiagramRequest={
                  onMoveDiagramToFolder ? (id, anchor) => openMovePicker(id, anchor) : undefined
                }
              />
            </ul>
          ) : null}
        </div>

        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600">
          <p className="font-medium text-slate-800">Sign in to keep your diagrams</p>
          <p className="mt-1 leading-relaxed text-slate-500">
            A free account is required to keep your diagrams across sessions.
          </p>
          <Tooltip title="Sign in" description="Coming soon.">
            <button
              type="button"
              disabled
              aria-disabled
              className="mt-3 inline-flex w-full cursor-not-allowed items-center justify-center rounded-md bg-brand-500/60 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            >
              Sign in (coming soon)
            </button>
          </Tooltip>
        </div>
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
  onOpenDiagram: (id: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild: (parentId: string) => Promise<void> | void;
  onDeleteDiagram?: (id: string) => void;
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
              onDuplicateDiagram={onDuplicateDiagram}
              onMoveDiagramRequest={onMoveDiagramRequest}
            />
          ))}
          {childDiagrams.map((d) => (
            <li key={d.id} style={{ paddingLeft: 4 + (depth + 1) * 12 }}>
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
  onDuplicateDiagram,
  onMoveDiagramRequest,
}: {
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  onOpenDiagram: (id: string) => void;
  onDeleteDiagram?: (id: string) => void;
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
            <li key={d.id} style={{ paddingLeft: 16 }}>
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
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex flex-1 items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition hover:bg-slate-100"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block transition-transform ${open ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
        </span>
        {badge !== null ? (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
            {badge}
          </span>
        ) : null}
      </button>
      {trailing}
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
          <span
            className={
              active
                ? 'truncate text-[10px] font-normal text-brand-700/80'
                : 'truncate text-[10px] text-slate-400'
            }
            title={new Date(item.savedAt).toLocaleString()}
          >
            Updated {relative}
          </span>
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
