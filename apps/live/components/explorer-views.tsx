'use client';

// Presentational primitives for the floating Explorer panel
// (apps/live/components/Explorer.tsx). Lifted here so the
// Explorer component itself can focus on data flow + the panel
// shell, and so this file can group the 5 row / node primitives
// that cross-reference each other (FolderNode renders DiagramRow,
// UnsortedNode renders DiagramRow). Same pattern as the route's
// app/explorer/views.tsx split: stateless or near-stateless
// renderers that take their data + callbacks via props.
//
// Mirror of (not duplicate with) app/explorer/views.tsx: the
// route's full-page list view has its own DiagramRow / FolderRow
// shape (grid layout, dropdown menu, no drag), whereas this file
// owns the floating-panel shape (pill rows, drag source / drop
// target, recursive tree). The two coexist by design.

import { useEffect, useMemo, useRef, useState } from 'react';
// Row data shapes come straight from the api client (the same rows
// apiListDiagrams / useFolders / apiListSharedWith return) so the
// panel and the /explorer route can't drift apart on what a list
// item carries.
import type { DiagramListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { InlineRenameInput } from './InlineRenameInput';
import { MenuItem, PortalMenu } from './PortalMenu';
import { Tooltip } from './Tooltip';
import {
  ChevronIcon,
  DiagramIcon,
  DuplicateIcon,
  FolderIcon,
  OpenIcon,
  PencilIcon,
  PlusIcon,
  RemoveIcon,
  SharedDiagramIcon,
  TrashIcon,
  UnsortedIcon,
} from './explorer-icons';

// Custom MIME type for the diagram-to-folder drag flow. A custom
// type means dropping a diagram outside any registered target (the
// page background, the URL bar, an unrelated app) is a no-op rather
// than triggering a browser navigation to "the dragged URL".
export const DIAGRAM_DRAG_MIME = 'application/x-livediagram-id';

// Recursive folder node in the panel's tree. Renders its label +
// chevron + menu, and when expanded reveals child folders (recursive)
// + the diagrams in this folder (DiagramRow).
export function FolderNode({
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
  onMoveDiagramToFolder,
}: {
  folder: Folder;
  depth: number;
  foldersByParent: Map<string | null, Folder[]>;
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
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  // Set of diagram ids currently mid slide-out animation. Passed
  // down from the Explorer's wrappedDeleteDiagram so every row in
  // the tree can apply the matching animation class.
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
  // Drop target callback for the DnD flow. Picks up
  // `application/x-livediagram-id` off the dataTransfer when a
  // diagram row is dropped on this folder's header and routes the
  // move through the same handler the picker uses.
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
}) {
  const isExpanded = expanded[folder.id] ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const childFolders = foldersByParent.get(folder.id) ?? [];
  const childDiagrams = diagramsByFolder.get(folder.id) ?? [];
  const childCount = childFolders.length + childDiagrams.length;

  const [editing, setEditing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-enter rename mode for freshly-created folders.
  useEffect(() => {
    if (pendingRenameId === folder.id) {
      setEditing(true);
      onRenameFolderCommitted();
    }
  }, [pendingRenameId, folder.id, onRenameFolderCommitted]);

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== folder.name && onRenameFolder) onRenameFolder(folder.id, next);
    setEditing(false);
  };

  // Drop-target wiring. preventDefault on dragOver is what permits
  // the drop; without it the browser blocks the drop with a circle-
  // slash cursor. dataTransfer.types is consulted on enter so a
  // random text drag from another app doesn't trigger our hover
  // styling.
  const acceptsDrop = (e: React.DragEvent) =>
    !!onMoveDiagramToFolder && e.dataTransfer.types.includes(DIAGRAM_DRAG_MIME);
  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = () => {
    if (isDragOver) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const id = e.dataTransfer.getData(DIAGRAM_DRAG_MIME);
    setIsDragOver(false);
    if (id && onMoveDiagramToFolder) onMoveDiagramToFolder(id, folder.id);
  };

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
          isDragOver ? 'ring-2 ring-brand-400 ring-inset bg-brand-50 dark:bg-brand-500/15' : ''
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onDragOver={onMoveDiagramToFolder ? handleDragOver : undefined}
        onDragLeave={onMoveDiagramToFolder ? handleDragLeave : undefined}
        onDrop={onMoveDiagramToFolder ? handleDrop : undefined}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400 dark:text-slate-500">
          <FolderIcon />
        </span>
        {editing ? (
          <InlineRenameInput
            initial={folder.name}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
            className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <button
            type="button"
            onClick={() => onToggleExpanded(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
          >
            <span className="truncate">{folder.name}</span>
            <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
              {childCount}
            </span>
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
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-100 transition hover:bg-slate-200/70 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
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
              onMoveDiagramToFolder={onMoveDiagramToFolder}
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
                draggable={!!onMoveDiagramToFolder}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={onDeleteDiagram ? (anchor) => onDeleteDiagram(d.id, anchor) : undefined}
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
export function UnsortedNode({
  expanded,
  onToggleExpanded,
  diagrams,
  currentDiagramId,
  onOpenDiagram,
  onDeleteDiagram,
  exitingDiagramIds,
  onDuplicateDiagram,
  onMoveDiagramRequest,
  onMoveDiagramToFolder,
}: {
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  onOpenDiagram: (id: string, shareCode?: string) => void;
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
  exitingDiagramIds: Set<string>;
  onDuplicateDiagram?: (id: string) => void;
  onMoveDiagramRequest?: (diagramId: string, anchor: HTMLElement | null) => void;
  // Drop target callback; receives `null` as the folder id to drop
  // the diagram back to root (Unsorted is the synthetic null folder).
  onMoveDiagramToFolder?: (diagramId: string, folderId: string | null) => void;
}) {
  const isExpanded = expanded['unsorted'] ?? false;
  const [isDragOver, setIsDragOver] = useState(false);

  // Same drop wiring as FolderNode but the move callback gets a
  // null folderId so the diagram lands in Unsorted (the root
  // bucket).
  const acceptsDrop = (e: React.DragEvent) =>
    !!onMoveDiagramToFolder && e.dataTransfer.types.includes(DIAGRAM_DRAG_MIME);
  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = () => {
    if (isDragOver) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const id = e.dataTransfer.getData(DIAGRAM_DRAG_MIME);
    setIsDragOver(false);
    if (id && onMoveDiagramToFolder) onMoveDiagramToFolder(id, null);
  };

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
          isDragOver ? 'ring-2 ring-brand-400 ring-inset bg-brand-50 dark:bg-brand-500/15' : ''
        }`}
        onDragOver={onMoveDiagramToFolder ? handleDragOver : undefined}
        onDragLeave={onMoveDiagramToFolder ? handleDragLeave : undefined}
        onDrop={onMoveDiagramToFolder ? handleDrop : undefined}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Unsorted' : 'Expand Unsorted'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400 dark:text-slate-500">
          <UnsortedIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded('unsorted')}
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
        >
          <span className="truncate italic text-slate-500 dark:text-white">Unsorted</span>
          <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
            {diagrams.length}
          </span>
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
                draggable={!!onMoveDiagramToFolder}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={onDeleteDiagram ? (anchor) => onDeleteDiagram(d.id, anchor) : undefined}
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
// affordances: the visitor doesn't own these diagrams, so the
// only meaningful actions are "open" and "dismiss this row from my
// list." A small role pill ("View" / "Edit") communicates what they
// can do once they're in.
export function SharedRow({
  item,
  active,
  onOpen,
  onDismiss,
}: {
  item: SharedWithItem;
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
          active
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
            : 'hover:bg-slate-50 text-slate-700 dark:text-white dark:hover:bg-slate-800'
        }`}
      >
        <span
          className={
            active ? 'text-brand-500 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'
          }
        >
          <SharedDiagramIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{item.name}</span>
          {/* Tight meta line: just the role + relative-time.
              Owner attribution + "Updated" lived here before but
              read too dense in a narrow column; role is the load-
              bearing affordance and the timestamp grounds it. */}
          <span className="block truncate text-[10px] text-slate-500 dark:text-white">
            {item.role === 'edit' ? 'Edit' : 'View'} · {relative}
          </span>
        </span>
      </button>
      {onDismiss ? (
        <div className="absolute right-1.5 top-1.5 block sm:hidden sm:group-hover:block sm:group-focus-within:block">
          <Tooltip title="Remove" description="Drop this from your Shared list.">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label={`Remove ${item.name} from Shared`}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            >
              <RemoveIcon />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </li>
  );
}

// Accordion header used for top-level sections. Trailing slot lets
// callers tuck extra controls (e.g. "New folder") into the header
// next to the badge.
export function AccordionHeader({
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
    // misclick onto, but the badge is purely informational and
    // doesn't need to react to a row-level toggle, so it lives
    // outside.
    <div className="flex items-center gap-1 px-1 py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span
          className={`inline-block transition-transform ${open ? 'rotate-90' : 'rotate-0'}`}
          aria-hidden
        >
          <ChevronIcon />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white">
          {label}
        </span>
        {/* Badge sits right next to the title (not pushed to the far
            right) so the count reads as part of the section name. */}
        {badge !== null ? (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-white">
            {badge}
          </span>
        ) : null}
      </button>
      {trailing}
    </div>
  );
}

// Single diagram entry. Acts as both the Current Diagram row (active
// state, optional inline rename) and a Recent Diagrams row (Open /
// Delete / Duplicate / Move menu).
export function DiagramRow({
  item,
  active,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onMoveRequest,
  draggable: isDraggable,
}: {
  item: DiagramListItem;
  active: boolean;
  onOpen: () => void;
  onRename?: (name: string) => void;
  // Asks the parent to open the delete-confirm popover anchored to the
  // passed element (the row's menu button) — see onMoveRequest.
  onDelete?: (anchor: HTMLElement | null) => void;
  onDuplicate?: () => void;
  // Asks the parent Explorer to open the "Move to folder…" picker
  // anchored to the supplied element. Stored at the panel level so
  // the portal isn't nested inside another PortalMenu.
  onMoveRequest?: (anchor: HTMLElement | null) => void;
  // Set true on rows the user can drag into folders. The actual
  // drop handling lives on FolderNode + UnsortedNode; this row just
  // sets the custom MIME data so a drop target knows what was
  // dragged.
  draggable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== item.name && onRename) onRename(next);
    setEditing(false);
  };

  const hasMenu = Boolean((onRename && active) || onDelete || onDuplicate || onMoveRequest);
  const relative = formatRelativeTime(Date.now() - item.savedAt);

  const pillClasses = active
    ? 'group flex items-stretch rounded-md bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
    : 'group flex items-stretch rounded-md text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800';

  // The row's main area is a clickable <button> when not editing
  // (clicking the row opens the diagram). When editing it has to
  // become a plain <div>: nesting an <input> inside a <button> is
  // invalid HTML and browsers redirect focus to the parent button,
  // which is the original cause of the "rename input won't take
  // focus" bug.
  const mainClass = `flex flex-1 items-start gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-left text-xs ${active ? 'font-medium' : ''}`;
  const mainInner = (
    <>
      <span className="mt-0.5">
        <DiagramIcon active={active} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <InlineRenameInput
            initial={item.name}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800"
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{item.name}</span>
            {item.shareCode ? (
              <Tooltip title="Has a share link" description="A share link exists for this diagram.">
                <span
                  className={`shrink-0 ${active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'}`}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M4.5 7.5a2.5 2.5 0 0 0 3.5 0l1.5-1.5a2.5 2.5 0 0 0-3.5-3.5L5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7.5 4.5a2.5 2.5 0 0 0-3.5 0L2.5 6a2.5 2.5 0 0 0 3.5 3.5L7 8.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Tooltip>
            ) : null}
          </span>
        )}
        <span
          className={
            active
              ? 'truncate text-[10px] font-normal text-brand-700/80 dark:text-brand-200/80'
              : 'truncate text-[10px] text-slate-400 dark:text-white'
          }
        >
          Updated {relative}
        </span>
      </span>
    </>
  );

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DIAGRAM_DRAG_MIME, item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={pillClasses}
      draggable={isDraggable && !editing}
      onDragStart={isDraggable && !editing ? handleDragStart : undefined}
    >
      {editing ? (
        <div className={mainClass}>{mainInner}</div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-current={active ? 'true' : undefined}
          className={mainClass}
        >
          {mainInner}
        </button>
      )}
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
          className={`mr-1 flex w-6 shrink-0 items-center justify-center self-center rounded text-slate-400 opacity-100 transition hover:bg-slate-200/70 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
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
              label="Change Folder"
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
                // Hand the menu button up as the anchor so the panel can
                // open the delete-confirm popover beside it (same pattern
                // as Move to folder…).
                onDelete(menuButtonRef.current);
                setMenuOpen(false);
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
    </div>
  );
}

// --- Teams accordion nodes (spec/35) ---------------------------------
// Mirror of FolderNode for the panel's Teams accordion: a team expands
// to its folder tree AND the diagrams inside each folder, which open
// in place (any joined member may open them). Folder management
// (rename / move / delete / new) stays on the team page, so a click on
// a folder NAME opens that page there; the nodes carry no menus or drop
// targets. Folder ids are globally unique, so they share the panel's
// one `expanded` record with the personal folder tree.

type TeamFolderTreeNode = { id: string; name: string; parentId: string | null };

function TeamFolderNode({
  folder,
  depth,
  childrenByParent,
  diagramsByFolder,
  currentDiagramId,
  expanded,
  onToggleExpanded,
  onOpenDiagram,
}: {
  folder: TeamFolderTreeNode;
  depth: number;
  childrenByParent: Map<string | null, TeamFolderTreeNode[]>;
  diagramsByFolder: Map<string | null, DiagramListItem[]>;
  currentDiagramId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  onOpenDiagram: (id: string) => void;
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const diagramsHere = diagramsByFolder.get(folder.id) ?? [];
  const hasContent = kids.length > 0 || diagramsHere.length > 0;
  const isExpanded = expanded[folder.id] ?? false;
  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          disabled={!hasContent}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-0 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {hasContent ? (
            <span
              className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              aria-hidden
            >
              <ChevronIcon />
            </span>
          ) : null}
        </button>
        <span className="text-slate-400 dark:text-slate-500">
          <FolderIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          className="min-w-0 flex-1 truncate text-left"
        >
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded && hasContent ? (
        <ul className="flex flex-col gap-0.5">
          {kids.map((k) => (
            <TeamFolderNode
              key={k.id}
              folder={k}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              diagramsByFolder={diagramsByFolder}
              currentDiagramId={currentDiagramId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onOpenDiagram={onOpenDiagram}
            />
          ))}
          {diagramsHere.map((d) => (
            <li key={d.id} style={{ paddingLeft: 4 + (depth + 1) * 12 }}>
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TeamNode({
  team,
  folders,
  diagrams,
  currentDiagramId,
  expanded,
  onToggleExpanded,
  onOpenTeam,
  onOpenDiagram,
}: {
  team: { id: string; name: string };
  // This team's folder rows (flat, with parentId).
  folders: TeamFolderTreeNode[];
  // This team's diagrams (carry folderId; null = the team's Unsorted).
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  // The team NAME opens the full team page; folders + diagrams browse
  // inline in the panel (spec/35).
  onOpenTeam: (teamId: string) => void;
  onOpenDiagram: (id: string) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TeamFolderTreeNode[]>();
    for (const f of folders) {
      const bucket = map.get(f.parentId) ?? [];
      bucket.push(f);
      map.set(f.parentId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);
  const diagramsByFolder = useMemo(() => {
    const map = new Map<string | null, DiagramListItem[]>();
    for (const d of diagrams) {
      const bucket = map.get(d.folderId) ?? [];
      bucket.push(d);
      map.set(d.folderId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return map;
  }, [diagrams]);
  const rootFolders = childrenByParent.get(null) ?? [];
  // Diagrams loose at the team root (its synthetic Unsorted bucket).
  const rootDiagrams = diagramsByFolder.get(null) ?? [];
  const hasContent = rootFolders.length > 0 || rootDiagrams.length > 0;
  const isExpanded = expanded[team.id] ?? false;
  return (
    <li>
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
        <button
          type="button"
          onClick={() => onToggleExpanded(team.id)}
          aria-label={isExpanded ? 'Collapse team' : 'Expand team'}
          disabled={!hasContent}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-0 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {hasContent ? (
            <span
              className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              aria-hidden
            >
              <ChevronIcon />
            </span>
          ) : null}
        </button>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden>
          <TeamGlyph />
        </span>
        <button
          type="button"
          onClick={() => onOpenTeam(team.id)}
          className="min-w-0 flex-1 truncate text-left"
        >
          <span className="truncate">{team.name}</span>
        </button>
      </div>
      {isExpanded && hasContent ? (
        <ul className="flex flex-col gap-0.5">
          {rootFolders.map((f) => (
            <TeamFolderNode
              key={f.id}
              folder={f}
              depth={1}
              childrenByParent={childrenByParent}
              diagramsByFolder={diagramsByFolder}
              currentDiagramId={currentDiagramId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onOpenDiagram={onOpenDiagram}
            />
          ))}
          {rootDiagrams.map((d) => (
            <li key={d.id} style={{ paddingLeft: 4 + 1 * 12 }}>
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TeamGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
      <circle cx="11.5" cy="6.5" r="1.8" />
      <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
    </svg>
  );
}
