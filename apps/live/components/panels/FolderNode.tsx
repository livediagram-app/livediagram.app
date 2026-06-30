'use client';

import { useEffect, useRef, useState } from 'react';
import type { DiagramListItem, Folder } from '@/lib/api-client';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import {
  ChevronIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/panels/explorer-icons';
import { DIAGRAM_DRAG_MIME } from './explorer-drag-mime';
import { DiagramRow } from './DiagramRow';

// Recursive folder node in the panel's tree. Renders its label +
// chevron + menu, and when expanded reveals child folders (recursive)
// + the diagrams in this folder (DiagramRow).
export function FolderNode({
  folder,
  ownerId,
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
  // The VIEWER's owner id, threaded down to each DiagramRow for its
  // authenticated thumbnail fetch.
  ownerId: string | null;
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
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
          isDragOver ? 'ring-2 ring-brand-400 ring-inset bg-brand-50 dark:bg-brand-500/15' : ''
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onDragOver={onMoveDiagramToFolder ? handleDragOver : undefined}
        onDragLeave={onMoveDiagramToFolder ? handleDragLeave : undefined}
        onDrop={onMoveDiagramToFolder ? handleDrop : undefined}
        // Right-click anywhere on the folder row opens the same actions
        // menu as the ellipsis button (anchored to it).
        onContextMenu={
          editing
            ? undefined
            : (e) => {
                e.preventDefault();
                setMenuOpen(true);
              }
        }
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
            aria-hidden
          >
            <ChevronIcon />
          </span>
        </button>
        <span className="text-slate-400 dark:text-slate-400">
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
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-100 transition hover:bg-slate-200/70 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${
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
              ownerId={ownerId}
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
                ownerId={ownerId}
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
